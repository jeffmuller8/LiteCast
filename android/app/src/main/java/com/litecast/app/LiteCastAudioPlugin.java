package com.litecast.app;

import android.content.ComponentName;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;

/**
 * Bridges the web player (src/lib/native-audio.ts) to PlaybackService. Commands go to the
 * service's session through a MediaController; state changes come back as "state" events,
 * once a second while playing, so the web layer can save progress.
 */
@CapacitorPlugin(name = "LiteCastAudio")
public class LiteCastAudioPlugin extends Plugin {

    private static final long TICK_MS = 1000;

    // The loaded episode as the web layer described it, kept for the life of the process so
    // a reloaded WebView can pick up the episode that's still playing
    @Nullable
    private static String currentEpisodeJson;

    private final Handler main = new Handler(Looper.getMainLooper());

    @Nullable
    private ListenableFuture<MediaController> controllerFuture;

    @Nullable
    private MediaController controller;

    private interface ControllerAction {
        void run(MediaController controller);
    }

    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            if (controller != null && controller.isPlaying()) {
                emitState();
                main.postDelayed(this, TICK_MS);
            }
        }
    };

    private final Player.Listener listener = new Player.Listener() {
        @Override
        public void onEvents(@NonNull Player player, @NonNull Player.Events events) {
            if (
                events.containsAny(
                    Player.EVENT_PLAY_WHEN_READY_CHANGED,
                    Player.EVENT_PLAYBACK_STATE_CHANGED,
                    Player.EVENT_IS_PLAYING_CHANGED,
                    Player.EVENT_POSITION_DISCONTINUITY,
                    Player.EVENT_MEDIA_ITEM_TRANSITION,
                    Player.EVENT_PLAYBACK_PARAMETERS_CHANGED
                )
            ) {
                emitState();
            }
            if (events.contains(Player.EVENT_IS_PLAYING_CHANGED) && player.isPlaying()) {
                main.removeCallbacks(ticker);
                main.postDelayed(ticker, TICK_MS);
            }
        }

        @Override
        public void onPlayerError(@NonNull PlaybackException error) {
            JSObject data = new JSObject();
            data.put("code", error.errorCode);
            data.put("name", error.getErrorCodeName());
            data.put("message", error.getMessage() != null ? error.getMessage() : error.getErrorCodeName());
            notifyListeners("error", data);
        }
    };

    @Override
    public void load() {
        main.post(this::connect);
    }

    @Override
    protected void handleOnDestroy() {
        main.removeCallbacks(ticker);
        if (controller != null) controller.removeListener(listener);
        if (controllerFuture != null) MediaController.releaseFuture(controllerFuture);
        controller = null;
        controllerFuture = null;
    }

    // Main thread only
    private void connect() {
        if (controllerFuture != null) MediaController.releaseFuture(controllerFuture);
        controller = null;
        SessionToken token = new SessionToken(getContext(), new ComponentName(getContext(), PlaybackService.class));
        ListenableFuture<MediaController> future = new MediaController.Builder(getContext(), token)
            .setApplicationLooper(Looper.getMainLooper())
            .buildAsync();
        controllerFuture = future;
        future.addListener(
            () -> {
                if (future != controllerFuture) return;
                try {
                    controller = future.get();
                    controller.addListener(listener);
                    emitState();
                    if (controller.isPlaying()) main.postDelayed(ticker, TICK_MS);
                } catch (Exception e) {
                    controller = null;
                }
            },
            ContextCompat.getMainExecutor(getContext())
        );
    }

    // Main thread only. The controller future, reconnecting first if the service went away.
    private ListenableFuture<MediaController> ensureConnected() {
        if (controllerFuture == null || (controllerFuture.isDone() && (controller == null || !controller.isConnected()))) {
            connect();
        }
        return controllerFuture;
    }

    // Runs the action on the main thread once the controller is connected, then resolves the call
    private void withController(PluginCall call, ControllerAction action) {
        main.post(() -> {
            ListenableFuture<MediaController> future = ensureConnected();
            future.addListener(
                () -> {
                    MediaController c;
                    try {
                        c = future.get();
                    } catch (Exception e) {
                        call.reject("The player service is unavailable", e);
                        return;
                    }
                    try {
                        action.run(c);
                        call.resolve();
                    } catch (Exception e) {
                        call.reject(e.getMessage() != null ? e.getMessage() : "Player command failed", e);
                    }
                },
                ContextCompat.getMainExecutor(getContext())
            );
        });
    }

    private void emitState() {
        if (controller != null) notifyListeners("state", describe(controller));
    }

    private static JSObject describe(MediaController c) {
        JSObject state = new JSObject();
        state.put("playWhenReady", c.getPlayWhenReady());
        state.put("isPlaying", c.isPlaying());
        state.put("state", stateName(c.getPlaybackState()));
        state.put("position", c.getCurrentPosition() / 1000.0);
        long duration = c.getDuration();
        state.put("duration", duration == C.TIME_UNSET ? -1 : duration / 1000.0);
        state.put("speed", c.getPlaybackParameters().speed);
        MediaItem item = c.getCurrentMediaItem();
        state.put("url", item != null && item.localConfiguration != null ? item.localConfiguration.uri.toString() : null);
        state.put("episode", item != null ? currentEpisodeJson : null);
        return state;
    }

    private static String stateName(int state) {
        switch (state) {
            case Player.STATE_BUFFERING:
                return "buffering";
            case Player.STATE_READY:
                return "ready";
            case Player.STATE_ENDED:
                return "ended";
            default:
                return "idle";
        }
    }

    @PluginMethod
    public void load(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("An audio URL is required");
            return;
        }
        String artwork = call.getString("artworkUrl", "");
        MediaMetadata.Builder metadata = new MediaMetadata.Builder()
            .setTitle(call.getString("title", ""))
            .setArtist(call.getString("artist", ""))
            .setAlbumTitle("LiteCast");
        if (artwork != null && !artwork.isEmpty()) metadata.setArtworkUri(Uri.parse(artwork));
        MediaItem item = new MediaItem.Builder()
            .setMediaId(call.getString("id", url))
            .setUri(url)
            .setMediaMetadata(metadata.build())
            .build();
        long startMs = Math.max(0, Math.round(call.getDouble("position", 0.0) * 1000));
        float speed = call.getFloat("speed", 1f);
        String episode = call.getString("episode");

        withController(call, (c) -> {
            currentEpisodeJson = episode;
            c.setMediaItem(item, startMs);
            c.setPlaybackSpeed(speed);
            c.prepare();
        });
    }

    @PluginMethod
    public void play(PluginCall call) {
        withController(call, (c) -> {
            if (c.getPlaybackState() == Player.STATE_ENDED) c.seekToDefaultPosition();
            if (c.getPlaybackState() == Player.STATE_IDLE) c.prepare();
            c.play();
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        withController(call, MediaController::pause);
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        long positionMs = Math.max(0, Math.round(call.getDouble("position", 0.0) * 1000));
        withController(call, (c) -> c.seekTo(positionMs));
    }

    @PluginMethod
    public void setSpeed(PluginCall call) {
        float speed = call.getFloat("speed", 1f);
        withController(call, (c) -> c.setPlaybackSpeed(speed));
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        float volume = call.getFloat("volume", 1f);
        withController(call, (c) -> c.setVolume(volume));
    }

    @PluginMethod
    public void stop(PluginCall call) {
        withController(call, (c) -> {
            currentEpisodeJson = null;
            c.stop();
            c.clearMediaItems();
        });
    }

    @PluginMethod
    public void getState(PluginCall call) {
        main.post(() -> {
            ListenableFuture<MediaController> future = ensureConnected();
            future.addListener(
                () -> {
                    try {
                        call.resolve(describe(future.get()));
                    } catch (Exception e) {
                        call.reject("The player service is unavailable", e);
                    }
                },
                ContextCompat.getMainExecutor(getContext())
            );
        });
    }
}
