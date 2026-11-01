package com.harsh.voco;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.text.Html;
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
    public static final String EXTRA_HINDI_MEANING = "com.harsh.voco.EXTRA_HINDI_MEANING";
    public static final String EXTRA_HINDI_EXAMPLE = "com.harsh.voco.EXTRA_HINDI_EXAMPLE";
    public static final String EXTRA_NOTIFICATION_ID = "com.harsh.voco.EXTRA_NOTIFICATION_ID";
    public static final String EXTRA_IS_TEST = "com.harsh.voco.EXTRA_IS_TEST";

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
    private String hindiMeaning = "";
    private String hindiExample = "";
    private List<String> options = new ArrayList<>();
    private int correctIndex = 0;
    private boolean isTest = false;
    private int notificationId = -1;

    private boolean isFlashcardMode = true;
    private boolean hasAnswered = false;

    // Views
    private TextView textHeaderTag;
    private TextView textWord;

    // Flashcard views
    private LinearLayout layoutFlashcardPrompt;
    private LinearLayout layoutFlashcardButtons;
    private Button btnRemember;
    private Button btnDontRemember;
    private LinearLayout layoutRememberConfirmed;
    private TextView textRememberedMeaning;
    private Button btnRememberClose;

    // Quiz views
    private LinearLayout layoutQuizSection;
    private LinearLayout[] optionLayouts = new LinearLayout[4];
    private TextView[] optionBadges = new TextView[4];
    private TextView[] optionTexts = new TextView[4];

    private LinearLayout layoutFeedback;
    private LinearLayout bannerResult;
    private TextView textResultTitle;
    private TextView textResultMeaning;
    private LinearLayout layoutExample;
    private TextView textExample;
    private Button btnClose;
    private Button btnOpenApp;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_voco_quiz_dialog);

        // Configure window to match parent so transparent scrim dims background app
        getWindow().setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT);
        getWindow().setBackgroundDrawableResource(android.R.color.transparent);

        // Cancel ONLY the specific notification the user tapped; leave others intact
        notificationId = getIntent().getIntExtra(EXTRA_NOTIFICATION_ID, -1);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && notificationId != -1) {
            nm.cancel(notificationId);
        }

        // Handle Android system back gesture cleanly
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                dismissQuiz();
            }
        });

        readIntentData(getIntent());
        // Remove currently active notification from persistent pending queue
        VocoAlarmScheduler.removePendingNotification(this, notificationId, wordId);

        initViews();
        applyResponsiveCardWidth();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readIntentData(intent);
        VocoAlarmScheduler.removePendingNotification(this, notificationId, wordId);
        isFlashcardMode = true;
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
            hindiMeaning = intent.getStringExtra(EXTRA_HINDI_MEANING);
            hindiExample = intent.getStringExtra(EXTRA_HINDI_EXAMPLE);
            notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1);
            isTest = intent.getBooleanExtra(EXTRA_IS_TEST, false);

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
        // Outside scrim touch listener: dismiss dialog
        View rootScrim = findViewById(R.id.quiz_root_scrim);
        if (rootScrim != null) {
            rootScrim.setOnClickListener(v -> dismissQuiz());
        }

        View cardContainer = findViewById(R.id.quiz_card_container);
        if (cardContainer != null) {
            cardContainer.setOnClickListener(v -> {
                // Absorb click inside card
            });
        }

        textHeaderTag = findViewById(R.id.text_header_tag);
        textWord = findViewById(R.id.text_word);
        textWord.setText(wordText.toUpperCase());

        ImageView btnDismissX = findViewById(R.id.btn_dismiss_x);
        btnDismissX.setOnClickListener(v -> dismissQuiz());

        // Flashcard components
        layoutFlashcardPrompt = findViewById(R.id.layout_flashcard_prompt);
        layoutFlashcardButtons = findViewById(R.id.layout_flashcard_buttons);
        btnRemember = findViewById(R.id.btn_remember);
        btnDontRemember = findViewById(R.id.btn_dont_remember);
        layoutRememberConfirmed = findViewById(R.id.layout_remember_confirmed);
        textRememberedMeaning = findViewById(R.id.text_remembered_meaning);
        btnRememberClose = findViewById(R.id.btn_remember_close);

        // Quiz components
        layoutQuizSection = findViewById(R.id.layout_quiz_section);
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

        btnClose = findViewById(R.id.btn_close);
        btnOpenApp = findViewById(R.id.btn_open_app);

        // Initial state: Flashcard prompt visible, quiz section hidden
        isFlashcardMode = true;
        hasAnswered = false;

        textHeaderTag.setText("VOCO FLASHCARD 📖");
        layoutFlashcardPrompt.setVisibility(View.VISIBLE);
        layoutFlashcardButtons.setVisibility(View.VISIBLE);
        layoutRememberConfirmed.setVisibility(View.GONE);
        layoutQuizSection.setVisibility(View.GONE);
        layoutFeedback.setVisibility(View.GONE);

        // FLASHCARD BUTTONS
        btnRemember.setOnClickListener(v -> handleRememberClicked());
        btnDontRemember.setOnClickListener(v -> handleDontRememberClicked());

        // Prepare quiz options (ready if user taps 'Don't Remember')
        for (int i = 0; i < 4; i++) {
            optionTexts[i].setText(formatMarkdown(options.get(i)));
            optionLayouts[i].setBackgroundResource(R.drawable.bg_quiz_option_default);
            optionLayouts[i].setClickable(true);
            optionLayouts[i].setFocusable(true);

            optionBadges[i].setBackgroundResource(R.drawable.bg_quiz_badge_default);
            optionBadges[i].setTextColor(Color.parseColor("#475569"));

            final int index = i;
            optionLayouts[i].setOnClickListener(v -> handleOptionSelected(index));
        }

        btnOpenApp.setOnClickListener(v -> openMainVocoApp());
        btnClose.setOnClickListener(v -> dismissQuiz());
    }

    /**
     * Remember flow:
     * User remembers the word. Record progress, remove from pending queue,
     * and check remaining queue. If more words pending, show Next button;
     * otherwise show Close button.
     */
    private void handleRememberClicked() {
        recordQuizStats(wordText, true);
        VocoAlarmScheduler.removePendingNotification(this, notificationId, wordId);

        layoutFlashcardButtons.setVisibility(View.GONE);
        layoutRememberConfirmed.setVisibility(View.VISIBLE);
        textRememberedMeaning.setText(formatMarkdown(correctMeaning));

        int remaining = VocoAlarmScheduler.getPendingNotificationCount(this);

        if (!isTest && remaining > 0) {
            btnRememberClose.setText("Next Word (" + remaining + ")");
            btnRememberClose.setOnClickListener(v -> handleNextPendingWord());
        } else {
            btnRememberClose.setText("Close");
            btnRememberClose.setOnClickListener(v -> dismissQuiz());
        }
    }

    /**
     * Don't Remember flow:
     * Transition from Flashcard view to Multiple-Choice Quiz view.
     */
    private void handleDontRememberClicked() {
        isFlashcardMode = false;
        textHeaderTag.setText("VOCO PRACTICE ❓");
        layoutFlashcardPrompt.setVisibility(View.GONE);
        layoutQuizSection.setVisibility(View.VISIBLE);
    }

    private void handleOptionSelected(int chosenIndex) {
        if (hasAnswered) return;
        hasAnswered = true;

        for (LinearLayout layout : optionLayouts) {
            layout.setClickable(false);
            layout.setFocusable(false);
        }

        boolean isCorrect = (chosenIndex == correctIndex);
        recordQuizStats(wordText, isCorrect);
        VocoAlarmScheduler.removePendingNotification(this, notificationId, wordId);

        if (isCorrect) {
            optionLayouts[chosenIndex].setBackgroundResource(R.drawable.bg_quiz_option_correct);
            optionBadges[chosenIndex].setBackgroundResource(R.drawable.bg_quiz_badge_correct);
            optionBadges[chosenIndex].setTextColor(Color.WHITE);

            bannerResult.setBackgroundResource(R.drawable.bg_feedback_correct);
            textResultTitle.setText("Correct! 🎉");
            textResultTitle.setTextColor(Color.parseColor("#065F46"));
            textResultMeaning.setTextColor(Color.parseColor("#047857"));
            textResultMeaning.setText(formatMarkdown(correctMeaning));
        } else {
            optionLayouts[chosenIndex].setBackgroundResource(R.drawable.bg_quiz_option_incorrect);
            optionBadges[chosenIndex].setBackgroundResource(R.drawable.bg_quiz_badge_incorrect);
            optionBadges[chosenIndex].setTextColor(Color.WHITE);

            optionLayouts[correctIndex].setBackgroundResource(R.drawable.bg_quiz_option_correct);
            optionBadges[correctIndex].setBackgroundResource(R.drawable.bg_quiz_badge_correct);
            optionBadges[correctIndex].setTextColor(Color.WHITE);

            bannerResult.setBackgroundResource(R.drawable.bg_feedback_incorrect);
            textResultTitle.setText("Correct Answer");
            textResultTitle.setTextColor(Color.parseColor("#9F1239"));
            textResultMeaning.setTextColor(Color.parseColor("#1E293B"));

            StringBuilder sb = new StringBuilder(correctMeaning);
            if (hindiMeaning != null && !hindiMeaning.trim().isEmpty()) {
                sb.append("\n\n🇮🇳 ").append(hindiMeaning.trim());
            }
            textResultMeaning.setText(formatMarkdown(sb.toString()));
        }

        if (exampleSentence != null && !exampleSentence.trim().isEmpty()) {
            textExample.setText(formatMarkdown("\"" + exampleSentence.trim() + "\""));
            layoutExample.setVisibility(View.VISIBLE);
        } else {
            layoutExample.setVisibility(View.GONE);
        }

        layoutFeedback.setVisibility(View.VISIBLE);

        // Check true remaining pending count
        int remaining = VocoAlarmScheduler.getPendingNotificationCount(this);
        if (!isTest && remaining > 0) {
            btnClose.setText("Next Word (" + remaining + ")");
            btnClose.setOnClickListener(v -> handleNextPendingWord());
        } else {
            btnClose.setText("Close");
            btnClose.setOnClickListener(v -> dismissQuiz());
        }
    }

    /**
     * Loads the next pending word from queue and restarts with a fresh flashcard!
     */
    private void handleNextPendingWord() {
        org.json.JSONObject nextItem = VocoAlarmScheduler.popNextPendingNotification(this);
        if (nextItem == null) {
            dismissQuiz();
            return;
        }

        int nextNotifId = nextItem.optInt("notifId", -1);
        if (nextNotifId != -1) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(nextNotifId);
            }
        }

        wordId = nextItem.optString("wordId", "");
        wordText = nextItem.optString("wordText", "Vocabulary");
        correctMeaning = nextItem.optString("meaning", "");
        exampleSentence = nextItem.optString("example", "");
        hindiMeaning = nextItem.optString("hindiMeaning", "");
        hindiExample = nextItem.optString("hindiExample", "");
        correctIndex = nextItem.optInt("correctIndex", 0);
        notificationId = nextNotifId;
        isTest = nextItem.optBoolean("isTest", false);

        options = new ArrayList<>();
        org.json.JSONArray opts = nextItem.optJSONArray("options");
        if (opts != null && opts.length() >= 4) {
            for (int i = 0; i < opts.length(); i++) {
                options.add(opts.optString(i));
            }
        } else {
            options = fallbackOptions(correctMeaning);
            correctIndex = 0;
        }

        isFlashcardMode = true;
        hasAnswered = false;
        initViews();
    }

    /**
     * Formats markdown bold (**word** or __word__) to native HTML bold tags.
     */
    public static CharSequence formatMarkdown(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return "";
        }
        String cleaned = raw.replaceAll("\\\\([*_])", "$1");
        String html = cleaned.replaceAll("(?i)(\\*{2,3}|_{2,3})\\s*([^\\*_]+?)\\s*(\\*{2,3}|_{2,3})", "<b>$2</b>");
        html = html.replaceAll("(\\*{2,}|_{2,})", "");
        html = html.replace("\n", "<br/>");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            return Html.fromHtml(html, Html.FROM_HTML_MODE_LEGACY);
        } else {
            return Html.fromHtml(html);
        }
    }

    private void dismissQuiz() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            finishAndRemoveTask();
        } else {
            finish();
        }
    }

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
