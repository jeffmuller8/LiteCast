// In the Android app (Capacitor), episodes play through a native Media3 player that keeps going
// with the screen off and other apps open (android/app/src/main/java/com/litecast/app). The Mac
// app has an AVPlayer equivalent (macos/Sources/AudioPlayer.swift) behind the same interface.
// NativeAudio mirrors the parts of HTMLAudioElement the player uses, firing the same events,
// so player-context.tsx drives either one. In a browser none of this is used.

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { hasMacPlugin, macPlugin } from "./native-bridge";

export interface NativePlayerState {
  playWhenReady: boolean;
  isPlaying: boolean;
  state: "idle" | "buffering" | "ready" | "ended";
  position: number; // seconds
  duration: number; // seconds, -1 while unknown
  speed: number;
  url: string | null;
  episode: string | null; // JSON the web layer passed to load()
}

interface LiteCastAudioPlugin {
  load(options: {
    id: string;
    url: string;
    title: string;
    artist: string;
    artworkUrl: string;
    position: number;
    speed: number;
    episode: string;
  }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(options: { position: number }): Promise<void>;
  setSpeed(options: { speed: number }): Promise<void>;
  setVolume(options: { volume: number }): Promise<void>;
  stop(): Promise<void>;
  getState(): Promise<NativePlayerState>;
  addListener(event: "state", listener: (state: NativePlayerState) => void): Promise<PluginListenerHandle>;
  addListener(
    event: "error",
    listener: (error: { code: number; name: string; message: string }) => void
  ): Promise<PluginListenerHandle>;
}

const LiteCastAudio = hasMacPlugin("LiteCastAudio")
  ? macPlugin<LiteCastAudioPlugin>("LiteCastAudio")
  : registerPlugin<LiteCastAudioPlugin>("LiteCastAudio");

export function hasNativeAudio() {
  return hasMacPlugin("LiteCastAudio") || (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LiteCastAudio"));
}

/** What the player needs from an audio element; HTMLAudioElement and NativeAudio both fit. */
export interface AudioLike extends EventTarget {
  src: string;
  currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
  playbackRate: number;
  volume: number;
  play(): Promise<void>;
  pause(): void;
  load(): void;
}

export interface NativeTrack {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string;
  startAt: number;
  json: string; // handed back by getState() so a reloaded page can restore the episode
}

const logError = (action: string) => (e: unknown) => console.error(`Native player ${action} failed:`, e);

export class NativeAudio extends EventTarget implements AudioLike {
  error: { code: number; message: string } | null = null;
  nativeState: NativePlayerState["state"] = "idle";
  private _src = "";
  private _currentTime = 0;
  private _duration = NaN;
  private _paused = true;
  private _ended = false;
  private _rate = 1;
  private _volume = 1;
  private track: NativeTrack | null = null;
  private handles: Promise<PluginListenerHandle>[];

  constructor() {
    super();
    this.handles = [
      LiteCastAudio.addListener("state", (s) => this.applyState(s)),
      LiteCastAudio.addListener("error", (e) => {
        this.error = { code: e.code, message: `${e.name}: ${e.message}` };
        this.dispatchEvent(new Event("error"));
      }),
    ];
  }

  destroy() {
    this.handles.forEach((h) => h.then((handle) => handle.remove()));
  }

  /** Episode details for the notification and lock screen; call before setting src and load(). */
  setTrack(track: NativeTrack) {
    this.track = track;
  }

  get src() {
    return this._src;
  }
  set src(url: string) {
    this._src = url;
  }

  get currentTime() {
    return this._currentTime;
  }
  set currentTime(time: number) {
    this._currentTime = time;
    LiteCastAudio.seekTo({ position: time }).catch(logError("seek"));
    this.dispatchEvent(new Event("timeupdate"));
  }

  get duration() {
    return this._duration;
  }
  get paused() {
    return this._paused;
  }
  get ended() {
    return this._ended;
  }

  get playbackRate() {
    return this._rate;
  }
  set playbackRate(rate: number) {
    this._rate = rate;
    LiteCastAudio.setSpeed({ speed: rate }).catch(logError("speed"));
  }

  get volume() {
    return this._volume;
  }
  set volume(volume: number) {
    this._volume = volume;
    LiteCastAudio.setVolume({ volume }).catch(logError("volume"));
  }

  load() {
    const track = this.track;
    this._ended = false;
    this._duration = NaN;
    this.error = null;
    this._currentTime = track?.startAt ?? 0;
    LiteCastAudio.load({
      id: track?.id ?? this._src,
      url: this._src,
      title: track?.title ?? "",
      artist: track?.artist ?? "",
      artworkUrl: track?.artworkUrl ?? "",
      position: track?.startAt ?? 0,
      speed: this._rate,
      episode: track?.json ?? "",
    }).catch((e: unknown) => {
      this.error = { code: 0, message: e instanceof Error ? e.message : String(e) };
      this.dispatchEvent(new Event("error"));
    });
  }

  play() {
    this._ended = false;
    return LiteCastAudio.play();
  }

  pause() {
    LiteCastAudio.pause().catch(logError("pause"));
  }

  /** Pulls the native player's current state, adopting its episode if this page has none
   *  loaded (the page was reloaded while audio kept playing). */
  async sync(): Promise<NativePlayerState> {
    const state = await LiteCastAudio.getState();
    if (!this._src && state.url) this._src = state.url;
    this.applyState(state);
    return state;
  }

  private applyState(s: NativePlayerState) {
    // Ignore late updates about an episode we've already moved on from
    if (!this._src || s.url !== this._src) return;

    const prevState = this.nativeState;
    this.nativeState = s.state;
    this._rate = s.speed;

    if (s.duration > 0 && (Number.isNaN(this._duration) || Math.abs(s.duration - this._duration) > 0.5)) {
      const first = Number.isNaN(this._duration);
      this._duration = s.duration;
      this.dispatchEvent(new Event(first ? "loadedmetadata" : "durationchange"));
    }

    this._currentTime = s.position;
    this.dispatchEvent(new Event("timeupdate"));

    if (s.state === "ended") {
      if (this._ended) return;
      this._ended = true;
      this._paused = true;
      this.dispatchEvent(new Event("pause"));
      this.dispatchEvent(new Event("ended"));
      return;
    }

    const paused = !s.playWhenReady;
    if (paused !== this._paused) {
      this._paused = paused;
      this.dispatchEvent(new Event(paused ? "pause" : "play"));
    }
    if (s.state !== prevState && s.playWhenReady && (s.state === "buffering" || s.state === "ready")) {
      this.dispatchEvent(new Event(s.state === "buffering" ? "waiting" : "playing"));
    }
  }
}
