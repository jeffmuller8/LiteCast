package com.litecast.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LiteCastAudioPlugin.class);
        registerPlugin(LiteCastAuthPlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        // Keep the web page's process at full priority while the app is in the background, so
        // the player's progress saves and queue keep running alongside native playback
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        }

        // Back goes back within the app; at the first page it backgrounds the app instead of
        // closing it, so the page and its player stay alive
        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    if (webView.canGoBack()) {
                        webView.goBack();
                    } else {
                        moveTaskToBack(true);
                    }
                }
            }
        );
    }
}
