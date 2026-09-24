package com.cheffodoggo.wrapper;

import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Bundle;
import com.google.androidbrowserhelper.trusted.LauncherActivity;

public class CheffoLauncherActivity extends LauncherActivity {
    static final String OPEN_CACHED = "open_cached";

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (!hasConnection() && !getIntent().getBooleanExtra(OPEN_CACHED, false)) {
            startActivity(new Intent(this, OfflineActivity.class));
            finish();
        }
    }
    @Override protected boolean shouldLaunchImmediately() {
        return hasConnection() || getIntent().getBooleanExtra(OPEN_CACHED, false);
    }
    private boolean hasConnection() {
        ConnectivityManager manager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkCapabilities caps = manager.getNetworkCapabilities(manager.getActiveNetwork());
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }
    @Override protected Uri getLaunchingUrl() {
        Uri input = super.getLaunchingUrl();
        Uri base = Uri.parse(BuildConfig.WEB_ORIGIN);
        // Ignore external URLs even when another app explicitly targets this activity.
        if (!"https".equals(input.getScheme()) || !base.getAuthority().equals(input.getAuthority())) {
            input = Uri.parse(BuildConfig.WEB_ORIGIN + "/");
        }
        Uri.Builder result = input.buildUpon().clearQuery();
        for (String key : input.getQueryParameterNames()) {
            if (!"distribution".equals(key)) {
                for (String value : input.getQueryParameters(key)) result.appendQueryParameter(key, value);
            }
        }
        // Both app launches and incoming account/recipe links enforce the app UI.
        return result.appendQueryParameter("distribution", "google-play").build();
    }
}
