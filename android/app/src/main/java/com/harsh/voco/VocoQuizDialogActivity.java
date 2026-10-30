package com.harsh.voco;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
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

        // Configure window to match parent so scrim covers screen and dims underlying app (WhatsApp, etc.)
        getWindow().setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT);
        getWindow().setBackgroundDrawableResource(android.R.color.transparent);

        // Cancel notification since the user has tapped it and opened the quiz
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(VocoAlarmScheduler.NOTIFICATION_ID);
        }

        // Handle Android system back gesture/button cleanly
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                dismissQuiz();
            }
        });

        readIntentData(getIntent());
        initViews();
        applyResponsiveCardWidth();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readIntentData(intent);
        hasAnswered = false;
        initViews();
        applyResponsiveCardWidth();
    }

    private void readIntentData(Intent intent) {
        if (intent != null) {
            wordId = intent.getStringExtra(EXTRA_WORD_ID);
            wordText = intent.getStringExtra(EXTRA_WORD);
            correctMeaning = intent.getStringExtra(EXTRA_MEANING);
            exampleSentence = intent.getStringExtra(EXTRA_EXAMPLE);
            ArrayList<String> extraOpts = intent.getStringArrayListExtra(EXTRA_OPTIONS);
            if (extraOpts != null && extraOpts.size() >= 4) {
                options = extraOpts;
            } else {
                options = new ArrayList<>();
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
    }

    private void applyResponsiveCardWidth() {
        DisplayMetrics dm = getResources().getDisplayMetrics();
        int screenWidth = dm.widthPixels;
        int maxDialogWidth = (int) (420 * dm.density);
        int targetWidth = Math.min((int) (screenWidth * 0.92), maxDialogWidth);

        View card = findViewById(R.id.quiz_card_container);
        if (card != null) {
            ViewGroup.LayoutParams lp = card.getLayoutParams();
            if (lp != null) {
                lp.width = targetWidth;
                card.setLayoutParams(lp);
            }
        }
    }

    private void initViews() {
        // Outside scrim touch listener: dismiss dialog and return user to current app
        View rootScrim = findViewById(R.id.quiz_root_scrim);
        if (rootScrim != null) {
            rootScrim.setOnClickListener(v -> dismissQuiz());
        }

        // Prevent touches on the quiz card itself from dismissing the dialog
        View cardContainer = findViewById(R.id.quiz_card_container);
        if (cardContainer != null) {
            cardContainer.setOnClickListener(v -> {
                // Absorb click inside card
            });
        }

        TextView textWord = findViewById(R.id.text_word);
        textWord.setText(wordText.toUpperCase());

        ImageView btnDismissX = findViewById(R.id.btn_dismiss_x);
        btnDismissX.setOnClickListener(v -> dismissQuiz());

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

        // Reset state for new intent or initial load
        layoutFeedback.setVisibility(View.GONE);
        for (int i = 0; i < 4; i++) {
            optionTexts[i].setText(options.get(i));
            optionLayouts[i].setBackgroundResource(R.drawable.bg_quiz_option_default);
            optionLayouts[i].setClickable(true);
            optionLayouts[i].setFocusable(true);

            optionBadges[i].setBackgroundResource(R.drawable.bg_quiz_badge_default);
            optionBadges[i].setTextColor(Color.parseColor("#475569"));

            final int index = i;
            optionLayouts[i].setOnClickListener(v -> handleOptionSelected(index));
        }

        // LEFT BUTTON: Close - immediately finishes popup task and returns user to previous app
        btnClose.setOnClickListener(v -> dismissQuiz());

        // RIGHT BUTTON: Open Voco - explicitly launches main Voco React activity only when tapped
        btnOpenApp.setOnClickListener(v -> openMainVocoApp());
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

    /**
     * Finishes and removes this isolated dialog task, instantly restoring
     * whichever app the user was previously using (WhatsApp, YouTube, Chrome, etc.).
     */
    private void dismissQuiz() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            finishAndRemoveTask();
        } else {
            finish();
        }
    }

    /**
     * Explicitly launches the main Voco application only when the user taps "Open Voco".
     */
    private void openMainVocoApp() {
        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (wordId != null && !wordId.isEmpty()) {
            mainIntent.putExtra("quizWordId", wordId);
        }
        startActivity(mainIntent);
        dismissQuiz();
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
