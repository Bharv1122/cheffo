package com.cheffodoggo.wrapper;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class OfflineActivity extends Activity {
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        int pad = (int) (28 * getResources().getDisplayMetrics().density);
        layout.setPadding(pad, pad, pad, pad);
        layout.setBackgroundColor(Color.rgb(255, 251, 245));
        TextView title = new TextView(this);
        title.setText(R.string.offline_title); title.setTextSize(24); title.setTextColor(Color.rgb(43, 33, 24));
        layout.addView(title);
        TextView message = new TextView(this);
        message.setText(R.string.offline_message);
        message.setTextSize(17); message.setPadding(0, pad, 0, pad); message.setTextColor(Color.rgb(80, 69, 59));
        layout.addView(message);
        Button retry = new Button(this); retry.setText(R.string.offline_retry);
        retry.setOnClickListener(view -> open(false)); layout.addView(retry);
        Button cached = new Button(this); cached.setText(R.string.offline_cached);
        cached.setOnClickListener(view -> open(true)); layout.addView(cached);
        setContentView(layout);
    }
    private void open(boolean cached) {
        startActivity(new Intent(this, CheffoLauncherActivity.class).putExtra(CheffoLauncherActivity.OPEN_CACHED, cached));
        finish();
    }
}
