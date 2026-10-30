package com.harsh.voco;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import java.util.ArrayList;
import java.util.List;

public class VocoQuizDialogActivity extends AppCompatActivity {
    public static final String EXTRA_WORD_ID = "com.harsh.voco.EXTRA_WORD_ID";
    public static final String EXTRA_WORD = "com.harsh.voco.EXTRA_WORD";
    public static final String EXTRA_MEANING = "com.harsh.voco.EXTRA_MEANING";
    public static final String EXTRA_EXAMPLE = "com.harsh.voco.EXTRA_EXAMPLE";
    public static final String EXTRA_OPTIONS = "com.harsh.voco.EXTRA_OPTIONS";
    public static final String EXTRA_CORRECT_INDEX = "com.harsh.voco.EXTRA_CORRECT_INDEX";

    public static final String PREFS_QUIZ_STATS = "voco_quiz_stats";
    public static final String KEY_TOTAL_ANSWERED = "total_answered";
    public static final String KEY_CORRECT_ANSWERED = "correct_answered";
    public static final String KEY_LAST_RESULT_WORD = "last_result_word";
    public static final String KEY_LAST_RESULT_CORRECT = "last_result_correct";
    public static final String KEY_LAST_RESULT_TIME = "last_result_time";

    private String wordId = "";
    private String wordText = "";
    private String correctMeaning = "";
    private String exampleSentence = "";
    private List<String> options = new ArrayList<>();
    private int correctIndex = 0;
    private boolean hasAnswered = false;

    private LinearLayout[] optionLayouts = new LinearLayout[4];
    private TextView[] optionBadges = new TextView[4];
    private TextView[] optionTexts = new TextView[4];

    private LinearLayout layoutFeedback;
    private LinearLayout bannerResult;
    private TextView textResultTitle;
    private TextView textResultMeaning;
    private LinearLayout layoutExample;
    private TextView textExample;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_voco_quiz_dialog);

        // Responsive dialog sizing: 92% screen width up to a max of 420dp
        DisplayMetrics dm = getResources().getDisplayMetrics();
        int screenWidth = dm.widthPixels;
        int maxDialogWidth = (int) (420 * dm.density);
        int targetWidth = (int) (screenWidth * 0.92);
        if (targetWidth > maxDialogWidth) {
            targetWidth = maxDialogWidth;
        }

        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.width = targetWidth;
        lp.height = WindowManager.LayoutParams.WRAP_CONTENT;
        getWindow().setAttributes(lp);

        // Cancel notification since the user has tapped it and opened the quiz
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(VocoAlarmScheduler.NOTIFICATION_ID);
        }

        // Read intent extras
        Intent intent = getIntent();
        if (intent != null) {
            wordId = intent.getStringExtra(EXTRA_WORD_ID);
            wordText = intent.getStringExtra(EXTRA_WORD);
            correctMeaning = intent.getStringExtra(EXTRA_MEANING);
            exampleSentence = intent.getStringExtra(EXTRA_EXAMPLE);
            ArrayList<String> extraOpts = intent.getStringArrayListExtra(EXTRA_OPTIONS);
            if (extraOpts != null && extraOpts.size() >= 4) {
                options = extraOpts;
            }
            correctIndex = intent.getIntExtra(EXTRA_CORRECT_INDEX, 0);
        }

        if (wordText == null || wordText.isEmpty()) {
            wordText = "Vocabulary";
        }
        if (correctMeaning == null || correctMeaning.isEmpty()) {
            correctMeaning = "Learning vocabulary practice.";
        }
        if (options.size() < 4) {
            options = fallbackOptions(correctMeaning);
            correctIndex = 0;
        }

        initViews();
    }

    private void initViews() {
        TextView textWord = findViewById(R.id.text_word);
        textWord.setText(wordText.toUpperCase());

        ImageView btnDismissX = findViewById(R.id.btn_dismiss_x);
        btnDismissX.setOnClickListener(v -> finish());

        optionLayouts[0] = findViewById(R.id.layout_option_a);
        optionLayouts[1] = findViewById(R.id.layout_option_b);
        optionLayouts[2] = findViewById(R.id.layout_option_c);
        optionLayouts[3] = findViewById(R.id.layout_option_d);

        optionBadges[0] = findViewById(R.id.badge_option_a);
        optionBadges[1] = findViewById(R.id.badge_option_b);
        optionBadges[2] = findViewById(R.id.badge_option_c);
        optionBadges[3] = findViewById(R.id.badge_option_d);

        optionTexts[0] = findViewById(R.id.text_option_a);
        optionTexts[1] = findViewById(R.id.text_option_b);
        optionTexts[2] = findViewById(R.id.text_option_c);
        optionTexts[3] = findViewById(R.id.text_option_d);

        layoutFeedback = findViewById(R.id.layout_feedback);
        bannerResult = findViewById(R.id.banner_result);
        textResultTitle = findViewById(R.id.text_result_title);
        textResultMeaning = findViewById(R.id.text_result_meaning);
        layoutExample = findViewById(R.id.layout_example);
        textExample = findViewById(R.id.text_example);

        Button btnClose = findViewById(R.id.btn_close);
        Button btnOpenApp = findViewById(R.id.btn_open_app);

        for (int i = 0; i < 4; i++) {
            optionTexts[i].setText(options.get(i));
            final int index = i;
            optionLayouts[i].setOnClickListener(v -> handleOptionSelected(index));
        }

        btnClose.setOnClickListener(v -> finish());
        btnOpenApp.setOnClickListener(v -> {
            Intent mainIntent = new Intent(VocoQuizDialogActivity.this, MainActivity.class);
            mainIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            if (wordId != null && !wordId.isEmpty()) {
                mainIntent.putExtra("quizWordId", wordId);
            }
            startActivity(mainIntent);
            finish();
        });
    }

    private void handleOptionSelected(int chosenIndex) {
        if (hasAnswered) return;
        hasAnswered = true;

        // Disable all option clicks
        for (LinearLayout layout : optionLayouts) {
            layout.setClickable(false);
            layout.setFocusable(false);
        }

        boolean isCorrect = (chosenIndex == correctIndex);

        if (isCorrect) {
            optionLayouts[chosenIndex].setBackgroundResource(R.drawable.bg_quiz_option_correct);
            optionBadges[chosenIndex].setBackgroundResource(R.drawable.bg_quiz_badge_correct);
            optionBadges[chosenIndex].setTextColor(Color.WHITE);

            bannerResult.setBackgroundResource(R.drawable.bg_feedback_correct);
            textResultTitle.setText("Correct! 🎉");
            textResultTitle.setTextColor(Color.parseColor("#065F46"));
            textResultMeaning.setTextColor(Color.parseColor("#047857"));
        } else {
            // Selected wrong option
            optionLayouts[chosenIndex].setBackgroundResource(R.drawable.bg_quiz_option_incorrect);
            optionBadges[chosenIndex].setBackgroundResource(R.drawable.bg_quiz_badge_incorrect);
            optionBadges[chosenIndex].setTextColor(Color.WHITE);

            // Highlight true correct option
            optionLayouts[correctIndex].setBackgroundResource(R.drawable.bg_quiz_option_correct);
            optionBadges[correctIndex].setBackgroundResource(R.drawable.bg_quiz_badge_correct);
            optionBadges[correctIndex].setTextColor(Color.WHITE);

            bannerResult.setBackgroundResource(R.drawable.bg_feedback_incorrect);
            textResultTitle.setText("Not quite right");
            textResultTitle.setTextColor(Color.parseColor("#9F1239"));
            textResultMeaning.setTextColor(Color.parseColor("#BE123C"));
        }

        textResultMeaning.setText(correctMeaning);

        // Show example sentence if present
        if (exampleSentence != null && !exampleSentence.trim().isEmpty()) {
            textExample.setText("\"" + exampleSentence.trim() + "\"");
            layoutExample.setVisibility(View.VISIBLE);
        } else {
            layoutExample.setVisibility(View.GONE);
        }

        layoutFeedback.setVisibility(View.VISIBLE);

        // Record statistics locally in SharedPreferences for synchronization
        recordQuizStats(wordText, isCorrect);
    }

    private void recordQuizStats(String word, boolean isCorrect) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_QUIZ_STATS, MODE_PRIVATE);
            int total = prefs.getInt(KEY_TOTAL_ANSWERED, 0) + 1;
            int correct = prefs.getInt(KEY_CORRECT_ANSWERED, 0) + (isCorrect ? 1 : 0);

            prefs.edit()
                .putInt(KEY_TOTAL_ANSWERED, total)
                .putInt(KEY_CORRECT_ANSWERED, correct)
                .putString(KEY_LAST_RESULT_WORD, word)
                .putBoolean(KEY_LAST_RESULT_CORRECT, isCorrect)
                .putLong(KEY_LAST_RESULT_TIME, System.currentTimeMillis())
                .apply();
        } catch (Exception ignored) {
        }
    }

    private List<String> fallbackOptions(String meaning) {
        List<String> list = new ArrayList<>();
        list.add(meaning);
        list.add("Showing steady emotional poise and calmness during turbulent times.");
        list.add("Relating to cultural traditions, social customs, and collective behaviour.");
        list.add("Existing or continuing for only a brief and fleeting duration of time.");
        return list;
    }
}

