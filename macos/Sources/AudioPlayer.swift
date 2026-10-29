import AppKit
import AVFoundation
import MediaPlayer

/// The native player behind src/lib/native-audio.ts, mirroring the Android LiteCastAudio
/// plugin: same methods, and a "state" event once a second while playing (and on every
/// change) so the web layer saves progress. Publishes Now Playing info and answers media keys,
/// headphone buttons and Control Center.
final class AudioPlayer: NSObject {
    var emit: (String, [String: Any]) -> Void = { _, _ in }

    private static let skipBack: Double = 10
    private static let skipForward: Double = 30

    private let player = AVPlayer()
    private var wantsToPlay = false
    private var ended = false
    private var speed: Float = 1
    private var url: String?
    private var episodeJSON: String?
    private var title = ""
    private var artist = ""
    private var artwork: MPMediaItemArtwork?
    private var itemObservers: [NSObjectProtocol] = []
    private var statusObservation: NSKeyValueObservation?
    private var timeControlObservation: NSKeyValueObservation?
    private var timeObserver: Any?

    override init() {
        super.init()
        timeControlObservation = player.observe(\.timeControlStatus) { [weak self] _, _ in
            DispatchQueue.main.async { self?.changed() }
        }
        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 1, preferredTimescale: 1000),
            queue: .main
        ) { [weak self] _ in
            guard let self, self.player.timeControlStatus == .playing else { return }
            self.emitState()
        }
        setUpRemoteCommands()
    }

    // MARK: Bridge

    func handle(method: String, args: [String: Any], reply: @escaping (Any?, String?) -> Void) {
        switch method {
        case "load":
            guard let urlString = args["url"] as? String, let url = URL(string: urlString) else {
                return reply(nil, "An audio URL is required")
            }
            load(
                url: url,
                urlString: urlString,
                title: args["title"] as? String ?? "",
                artist: args["artist"] as? String ?? "",
                artworkURL: (args["artworkUrl"] as? String).flatMap(URL.init(string:)),
                position: number(args["position"]) ?? 0,
                speed: Float(number(args["speed"]) ?? 1),
                episode: args["episode"] as? String
            )
        case "play":
            play()
        case "pause":
            pause()
        case "seekTo":
            seek(to: number(args["position"]) ?? 0)
        case "setSpeed":
            setSpeed(Float(number(args["speed"]) ?? 1))
        case "setVolume":
            player.volume = Float(number(args["volume"]) ?? 1)
        case "stop":
            stop()
        case "getState":
            return reply(state(), nil)
        default:
            return reply(nil, "Unknown method \(method)")
        }
        reply(nil, nil)
    }

    private func number(_ value: Any?) -> Double? {
        (value as? NSNumber)?.doubleValue
    }

    // MARK: Playback

    private func load(
        url: URL,
        urlString: String,
        title: String,
        artist: String,
        artworkURL: URL?,
        position: Double,
        speed: Float,
        episode: String?
    ) {
        let item = AVPlayerItem(url: url)
        item.audioTimePitchAlgorithm = .spectral // Keeps voices natural at other speeds
        observe(item)

        self.url = urlString
        self.episodeJSON = episode
        self.title = title
        self.artist = artist
        self.artwork = nil
        self.speed = speed
        wantsToPlay = false
        ended = false

        player.pause()
        player.replaceCurrentItem(with: item)
        player.defaultRate = speed
        if position > 0 {
            player.seek(to: CMTime(seconds: position, preferredTimescale: 1000), toleranceBefore: .zero, toleranceAfter: .zero)
        }
        loadArtwork(artworkURL, for: urlString)
        changed()
    }

    private func play() {
        guard player.currentItem != nil else { return }
        if ended {
            ended = false
            player.seek(to: .zero)
        }
        wantsToPlay = true
        player.defaultRate = speed
        player.play()
        changed()
    }

    private func pause() {
        wantsToPlay = false
        player.pause()
        changed()
    }

    private func seek(to position: Double) {
        guard let item = player.currentItem else { return }
        var target = max(0, position)
        if item.duration.isNumeric { target = min(target, item.duration.seconds) }
        if ended, target < (item.duration.isNumeric ? item.duration.seconds : .infinity) {
            ended = false
        }
        player.seek(to: CMTime(seconds: target, preferredTimescale: 1000), toleranceBefore: .zero, toleranceAfter: .zero) {
            [weak self] _ in
            DispatchQueue.main.async { self?.changed() }
        }
    }

    private func skip(by seconds: Double) {
        seek(to: player.currentTime().seconds + seconds)
    }

    private func setSpeed(_ newSpeed: Float) {
        speed = newSpeed
        player.defaultRate = newSpeed
        if wantsToPlay, player.rate != 0 { player.rate = newSpeed }
        changed()
    }

    private func stop() {
        wantsToPlay = false
        ended = false
        player.pause()
        player.replaceCurrentItem(with: nil)
        clearItemObservers()
        url = nil
        episodeJSON = nil
        artwork = nil
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        MPNowPlayingInfoCenter.default().playbackState = .stopped
        emitState()
    }

    private func observe(_ item: AVPlayerItem) {
        clearItemObservers()
        let center = NotificationCenter.default
        itemObservers = [
            center.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) { [weak self] _ in
                guard let self else { return }
                self.ended = true
                self.wantsToPlay = false
                self.changed()
            },
            center.addObserver(forName: .AVPlayerItemFailedToPlayToEndTime, object: item, queue: .main) { [weak self] note in
                let error = note.userInfo?[AVPlayerItemFailedToPlayToEndTimeErrorKey] as? Error
                self?.emitError(error, name: "FAILED_TO_PLAY_TO_END")
            },
        ]
        statusObservation = item.observe(\.status) { [weak self] item, _ in
            DispatchQueue.main.async {
                if item.status == .failed { self?.emitError(item.error, name: "LOAD_FAILED") }
                self?.changed()
            }
        }
    }

    private func clearItemObservers() {
        itemObservers.forEach(NotificationCenter.default.removeObserver)
        itemObservers = []
        statusObservation = nil
    }

    // MARK: State

    private func changed() {
        emitState()
        updateNowPlaying()
    }

    private func stateName() -> String {
        guard let item = player.currentItem else { return "idle" }
        if ended { return "ended" }
        switch item.status {
        case .failed: return "idle"
        case .unknown: return "buffering"
        default: break
        }
        return player.timeControlStatus == .waitingToPlayAtSpecifiedRate ? "buffering" : "ready"
    }

    private func state() -> [String: Any] {
        let position = player.currentTime().seconds
        let duration = player.currentItem?.duration
        return [
            "playWhenReady": wantsToPlay,
            "isPlaying": player.timeControlStatus == .playing,
            "state": stateName(),
            "position": position.isFinite ? position : 0,
            "duration": duration.map { $0.isNumeric ? $0.seconds : -1 } ?? -1,
            "speed": speed,
            "url": url ?? NSNull(),
            "episode": (player.currentItem != nil ? episodeJSON : nil) ?? NSNull(),
        ]
    }

    private func emitState() {
        emit("state", state())
    }

    private func emitError(_ error: Error?, name: String) {
        let nsError = error as NSError?
        emit("error", [
            "code": nsError?.code ?? 0,
            "name": name,
            "message": nsError?.localizedDescription ?? name,
        ])
    }

    // MARK: Now Playing and remote controls

    private func updateNowPlaying() {
        let center = MPNowPlayingInfoCenter.default()
        guard let item = player.currentItem else {
            center.nowPlayingInfo = nil
            center.playbackState = .stopped
            return
        }
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: artist,
            MPMediaItemPropertyAlbumTitle: "Cast Lite",
            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: max(0, player.currentTime().seconds),
            MPNowPlayingInfoPropertyPlaybackRate: player.timeControlStatus == .playing ? Double(speed) : 0,
            MPNowPlayingInfoPropertyDefaultPlaybackRate: Double(speed),
        ]
        if item.duration.isNumeric { info[MPMediaItemPropertyPlaybackDuration] = item.duration.seconds }
        if let artwork { info[MPMediaItemPropertyArtwork] = artwork }
        center.nowPlayingInfo = info
        center.playbackState = wantsToPlay ? .playing : .paused
    }

    private func loadArtwork(_ artworkURL: URL?, for urlString: String) {
        guard let artworkURL else { return }
        URLSession.shared.dataTask(with: artworkURL) { [weak self] data, _, _ in
            guard let data, let image = NSImage(data: data) else { return }
            DispatchQueue.main.async {
                guard let self, self.url == urlString else { return }
                self.artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                self.updateNowPlaying()
            }
        }.resume()
    }

    private func setUpRemoteCommands() {
        let commands = MPRemoteCommandCenter.shared()
        commands.playCommand.addTarget { [weak self] _ in
            self?.play()
            return .success
        }
        commands.pauseCommand.addTarget { [weak self] _ in
            self?.pause()
            return .success
        }
        commands.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            self.wantsToPlay ? self.pause() : self.play()
            return .success
        }
        commands.skipBackwardCommand.preferredIntervals = [NSNumber(value: Self.skipBack)]
        commands.skipBackwardCommand.addTarget { [weak self] _ in
            self?.skip(by: -Self.skipBack)
            return .success
        }
        commands.skipForwardCommand.preferredIntervals = [NSNumber(value: Self.skipForward)]
        commands.skipForwardCommand.addTarget { [weak self] _ in
            self?.skip(by: Self.skipForward)
            return .success
        }
        // The keyboard's previous/next keys skip within the episode, like most podcast apps
        commands.previousTrackCommand.addTarget { [weak self] _ in
            self?.skip(by: -Self.skipBack)
            return .success
        }
        commands.nextTrackCommand.addTarget { [weak self] _ in
            self?.skip(by: Self.skipForward)
            return .success
        }
        commands.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            self?.seek(to: event.positionTime)
            return .success
        }
    }
}
