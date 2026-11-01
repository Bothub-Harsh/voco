package com.harsh.voco;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ObjectAnimator;
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
import android.view.animation.AccelerateInterpolator;
import android.view.animation.DecelerateInterpolator;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

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
    private int notificationId = -1;

    // Flip card state
    private boolean isShowingFront = true;
    private boolean isFlipping = false;

    // Views
    private TextView textHeaderTag;
    private TextView textPendingBadge;
    private FrameLayout layoutFlipCard;
    private LinearLayout layoutCardFront;
    private TextView textWord;
    private TextView textQuestion;
    private LinearLayout layoutCardBack;
    private TextView textBackMeaning;
    private LinearLayout layoutBackHindi;
    private TextView textBackHindi;
    private LinearLayout layoutBackExample;
    private TextView textBackExample;
    private Button btnBottomAction;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_voco_quiz_dialog);

        // Configure window to match parent so transparent scrim dims background app
        getWindow().setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT);
        getWindow().setBackgroundDrawableResource(android.R.color.transparent);

        // Cancel ONLY the specific notification the user tapped; leave others intact in status bar
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

        initViews();
        applyResponsiveCardWidth();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readIntentData(intent);

        notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && notificationId != -1) {
            nm.cancel(notificationId);
        }

        resetToFront();
        initViews();
        applyResponsiveCardWidth();
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Recalculate button state whenever activity regains focus
        updateBottomButton();
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
        }

        if (wordText == null || wordText.isEmpty()) {
            wordText = "Vocabulary";
        }
        if (correctMeaning == null || correctMeaning.isEmpty()) {
            correctMeaning = "Learning vocabulary practice.";
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
                // Absorb click inside card container
            });
        }

        textHeaderTag = findViewById(R.id.text_header_tag);
        textPendingBadge = findViewById(R.id.text_pending_badge);
        ImageView btnDismissX = findViewById(R.id.btn_dismiss_x);
        btnDismissX.setOnClickListener(v -> dismissQuiz());

        layoutFlipCard = findViewById(R.id.layout_flip_card);
        layoutCardFront = findViewById(R.id.layout_card_front);
        textWord = findViewById(R.id.text_word);
        textQuestion = findViewById(R.id.text_question);

        layoutCardBack = findViewById(R.id.layout_card_back);
        textBackMeaning = findViewById(R.id.text_back_meaning);
        layoutBackHindi = findViewById(R.id.layout_back_hindi);
        textBackHindi = findViewById(R.id.text_back_hindi);
        layoutBackExample = findViewById(R.id.layout_back_example);
        textBackExample = findViewById(R.id.text_back_example);

        btnBottomAction = findViewById(R.id.btn_bottom_action);

        // Flashcard Flip Listener: tapping card triggers 3D flip between front and back
        layoutFlipCard.setOnClickListener(v -> flipCard());
        layoutCardFront.setOnClickListener(v -> flipCard());
        layoutCardBack.setOnClickListener(v -> flipCard());

        populateCardData();
        updateBottomButton();

        // ─── Dynamic Next / Close Button Listener ───
        btnBottomAction.setOnClickListener(v -> {
            int otherPending = VocoAlarmScheduler.getOtherPendingNotificationCount(this, wordId);
            if (otherPending > 0) {
                handleNextPendingWord();
            } else {
                dismissQuiz();
            }
        });
    }

    private void populateCardData() {
        textWord.setText(wordText.toUpperCase());
        textQuestion.setText("What does this word mean?");

        // Back: English Meaning formatted with bold emphasis, no asterisks
        textBackMeaning.setText(formatRichExplanation(correctMeaning, wordText));

        // Back: Hindi Meaning (gracefully hidden if missing)
        if (hindiMeaning != null && !hindiMeaning.trim().isEmpty()) {
            layoutBackHindi.setVisibility(View.VISIBLE);
            textBackHindi.setText(formatRichExplanation(hindiMeaning.trim(), wordText));
        } else {
            layoutBackHindi.setVisibility(View.GONE);
        }

        // Back: Example sentence (gracefully hidden if missing)
        if (exampleSentence != null && !exampleSentence.trim().isEmpty()) {
            layoutBackExample.setVisibility(View.VISIBLE);
            textBackExample.setText(formatRichExplanation("\"" + exampleSentence.trim() + "\"", wordText));
        } else {
            layoutBackExample.setVisibility(View.GONE);
        }
    }

    /**
     * Updates Next / Close button strictly based on other pending notification words.
     * If other pending words exist -> "Next".
     * If no other pending words exist -> "Close".
     */
    public void updateBottomButton() {
        int otherPending = VocoAlarmScheduler.getOtherPendingNotificationCount(this, wordId);

        if (otherPending > 0) {
            btnBottomAction.setText("Next");
            btnBottomAction.setBackgroundResource(R.drawable.bg_btn_primary);
            btnBottomAction.setTextColor(Color.WHITE);
            textPendingBadge.setVisibility(View.VISIBLE);
            textPendingBadge.setText("+" + otherPending + " more");
        } else {
            btnBottomAction.setText("Close");
            btnBottomAction.setBackgroundResource(R.drawable.bg_btn_primary);
            btnBottomAction.setTextColor(Color.WHITE);
            textPendingBadge.setVisibility(View.GONE);
        }
    }

    /**
     * Smooth 3D Flip Animation between Front and Back faces.
     */
    private void flipCard() {
        if (isFlipping) return;
        isFlipping = true;

        final View visibleCard = isShowingFront ? layoutCardFront : layoutCardBack;
        final View invisibleCard = isShowingFront ? layoutCardBack : layoutCardFront;

        float scale = getResources().getDisplayMetrics().density;
        float cameraDistance = 8000f * scale;
        layoutFlipCard.setCameraDistance(cameraDistance);
        visibleCard.setCameraDistance(cameraDistance);
        invisibleCard.setCameraDistance(cameraDistance);

        ObjectAnimator flipOut = ObjectAnimator.ofFloat(visibleCard, "rotationY", 0f, 90f);
        flipOut.setDuration(180);
        flipOut.setInterpolator(new AccelerateInterpolator());

        ObjectAnimator flipIn = ObjectAnimator.ofFloat(invisibleCard, "rotationY", -90f, 0f);
        flipIn.setDuration(180);
        flipIn.setInterpolator(new DecelerateInterpolator());

        flipOut.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator animation) {
                visibleCard.setVisibility(View.GONE);
                invisibleCard.setVisibility(View.VISIBLE);
                invisibleCard.setRotationY(-90f);
                flipIn.start();
            }
        });

        flipIn.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator animation) {
                isShowingFront = !isShowingFront;
                isFlipping = false;
            }
        });

        flipOut.start();
    }

    private void resetToFront() {
        if (isShowingFront) return;
        isShowingFront = true;
        isFlipping = false;
        if (layoutCardFront != null) {
            layoutCardFront.setVisibility(View.VISIBLE);
            layoutCardFront.setRotationY(0f);
        }
        if (layoutCardBack != null) {
            layoutCardBack.setVisibility(View.GONE);
            layoutCardBack.setRotationY(0f);
        }
    }

    /**
     * Opens the next pending notification word from the queue.
     */
    private void handleNextPendingWord() {
        // Remove current word from queue before popping the next
        VocoAlarmScheduler.removePendingNotification(this, notificationId, wordId);

        org.json.JSONObject nextItem = VocoAlarmScheduler.popNextPendingNotification(this, wordId);
        if (nextItem == null) {
            // Also try popping any remaining item
            nextItem = VocoAlarmScheduler.popNextPendingNotification(this, null);
        }

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
        notificationId = nextNotifId;

        resetToFront();
        populateCardData();
        updateBottomButton();
    }

    /**
     * Formats explanation text with bold emphasis on important words and the target vocabulary word.
     * Guaranteed: Never displays raw markdown asterisks (**) to the user.
     * Uses HTML <b> tags and Html.fromHtml() for actual rich text.
     */
    public static CharSequence formatRichExplanation(String raw, String targetWord) {
        if (raw == null || raw.trim().isEmpty()) {
            return "";
        }

        // 1. Unescape backslashes before formatting
        String text = raw.replaceAll("\\\\([*_`])", "$1");

        // 2. Convert existing markdown bold **phrase** or __phrase__ to <b>phrase</b>
        text = text.replaceAll("(?i)(\\*{2,3}|_{2,3})\\s*([^\\*_]+?)\\s*(\\*{2,3}|_{2,3})", "<b>$2</b>");

        // 3. Remove any remaining stray asterisks or underscores so raw markdown is NEVER visible
        text = text.replaceAll("[*_]{2,}", "");

        // 4. Bold target vocabulary word wherever it appears if not already enclosed in <b>
        if (targetWord != null && !targetWord.trim().isEmpty()) {
            String quoted = java.util.regex.Pattern.quote(targetWord.trim());
            text = text.replaceAll("(?i)(?<!<b>)\\b(" + quoted + ")\\b(?!<\\/b>)", "<b>$1</b>");
        }

        // 5. If text does NOT contain any <b> tags yet, naturally bold key definition words
        if (!text.contains("<b>") && !text.contains("</b>")) {
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(?i)\\b(to\\s+[a-z]{3,15}(\\s+[a-z]{3,15})?|means\\s+[a-z]{3,15}|ability\\s+to\\s+[a-z]{3,15}|feeling\\s+of\\s+[a-z]{3,15})\\b").matcher(text);
            if (m.find()) {
                text = text.substring(0, m.start()) + "<b>" + m.group() + "</b>" + text.substring(m.end());
            }
        }

        // 6. Line breaks to HTML
        text = text.replace("\n", "<br/>");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            return Html.fromHtml(text, Html.FROM_HTML_MODE_LEGACY);
        } else {
            return Html.fromHtml(text);
        }
    }

    private void dismissQuiz() {
        // Remove current word from queue upon clean dismissal
        VocoAlarmScheduler.removePendingNotification(this, notificationId, wordId);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            finishAndRemoveTask();
        } else {
            finish();
        }
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
}
