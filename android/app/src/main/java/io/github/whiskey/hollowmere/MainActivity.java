package io.github.whiskey.hollowmere;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * A thin native shell around the hosted game.
 *
 * The point of this class is storage, not rendering. The page is loaded from
 * GitHub Pages exactly as Chrome would load it, so the in-game update button
 * keeps working — it is only ever an HTTP fetch and a version-string compare.
 * But a WebView keeps localStorage under this app's own data directory rather
 * than in Chrome's, so clearing Chrome's site data cannot touch the saves.
 */
public class MainActivity extends Activity {

    private static final String GAME_URL = "https://whis-key.github.io/hollowmere/";

    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        // matches --ink in the game's stylesheet, so there is no white flash on launch
        web.setBackgroundColor(Color.parseColor("#17130f"));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        // Without this the game cannot save at all: localStorage is off by
        // default in a WebView, unlike in a browser.
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);

        // Keep every navigation inside the app rather than kicking out to Chrome,
        // which would land the player in a different storage box.
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });

        setContentView(web);

        if (savedInstanceState == null) {
            web.loadUrl(GAME_URL);
        } else {
            web.restoreState(savedInstanceState);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    /** Back navigates within the page before it closes the app. */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }
}
