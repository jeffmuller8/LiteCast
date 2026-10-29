package com.litecast.app;

import android.app.PendingIntent;
import android.content.Intent;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.session.CommandButton;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import com.google.common.collect.ImmutableList;

/**
 * Owns the native player. Media3 runs it as a foreground service while playing, which keeps
 * audio going with the screen off or another app open, and draws the notification and
 * lock-screen controls from the session.
 */
public class PlaybackService extends MediaSessionService {

    private static final long SKIP_BACK_MS = 10_000;
    private static final long SKIP_FORWARD_MS = 30_000;

    @Nullable
    private MediaSession session;

    @Override
    public void onCreate() {
        super.onCreate();

        // Podcast hosts often redirect through tracking prefixes that switch between http and https
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
            .setAllowCrossProtocolRedirects(true)
            .setUserAgent("CastLite/1.0 (Android)");

        ExoPlayer player = new ExoPlayer.Builder(this)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(new DefaultDataSource.Factory(this, http)))
            .setAudioAttributes(
                new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(),
                /* handleAudioFocus= */ true
            )
            .setHandleAudioBecomingNoisy(true)
            // Holds CPU and Wi-Fi locks while playing so streaming continues with the screen off
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .setSeekBackIncrementMs(SKIP_BACK_MS)
            .setSeekForwardIncrementMs(SKIP_FORWARD_MS)
            .build();

        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent openApp = PendingIntent.getActivity(
            this,
            0,
            launch,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        // Back 10s / forward 30s in place of previous / next on the notification and lock screen
        CommandButton back = new CommandButton.Builder(CommandButton.ICON_SKIP_BACK_10)
            .setDisplayName("Back 10 seconds")
            .setPlayerCommand(Player.COMMAND_SEEK_BACK)
            .setSlots(CommandButton.SLOT_BACK)
            .build();
        CommandButton forward = new CommandButton.Builder(CommandButton.ICON_SKIP_FORWARD_30)
            .setDisplayName("Forward 30 seconds")
            .setPlayerCommand(Player.COMMAND_SEEK_FORWARD)
            .setSlots(CommandButton.SLOT_FORWARD)
            .build();

        session = new MediaSession.Builder(this, player)
            .setSessionActivity(openApp)
            .setMediaButtonPreferences(ImmutableList.of(back, forward))
            .build();
    }

    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return session;
    }

    // Swiping the app away keeps an episode that's playing going; otherwise shut down
    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        Player player = session != null ? session.getPlayer() : null;
        if (player == null
            || !player.getPlayWhenReady()
            || player.getMediaItemCount() == 0
            || player.getPlaybackState() == Player.STATE_ENDED) {
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        if (session != null) {
            session.getPlayer().release();
            session.release();
            session = null;
        }
        super.onDestroy();
    }
}
