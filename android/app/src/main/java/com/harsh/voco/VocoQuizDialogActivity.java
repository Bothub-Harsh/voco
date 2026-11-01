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
    private boolean isTest = false;
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
        resetToFront();
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
                // Absorb click inside card
            });
        }

        textHeaderTag = findViewById(R.id.text_header_tag);
        textPendingBadge = findViewById(R.id.text_pending_badge);
        ImageView btnDismissX = findViewById(R.id.btn_dismiss_x);
        btnDismissX.setOnClickListener(v -> dismissQuiz());

        layoutFlipCard = findViewById(R.id.layout_flip_card);
        layoutCardFront = findViewById(R.id.layout_card_front);
        textWord = findViewById(R.id.text_word);

        layoutCardBack = findViewById(R.id.layout_card_back);
        textBackMeaning = findViewById(R.id.text_back_meaning);
        layoutBackHindi = findViewById(R.id.layout_back_hindi);
        textBackHindi = findViewById(R.id.text_back_hindi);
        layoutBackExample = findViewById(R.id.layout_back_example);
        textBackExample = findViewById(R.id.text_back_example);

        btnBottomAction = findViewById(R.id.btn_bottom_action);

        // Flashcard Flip Listener: tapping either face or container triggers 3D flip
        layoutFlipCard.setOnClickListener(v -> flipCard());
        layoutCardFront.setOnClickListener(v -> flipCard());
        layoutCardBack.setOnClickListener(v -> flipCard());

        populateCardData();
        updateBottomButton();

        // Bottom Action Button Listener
        btnBottomAction.setOnClickListener(v -> {
            int remaining = VocoAlarmScheduler.getPendingNotificationCount(this);
            if (!isTest && remaining > 0) {
                handleNextPendingWord();
            } else {
                dismissQuiz();
            }
        });
    }

    private void populateCardData() {
        textWord.setText(wordText.toUpperCase());

        // Back: English Meaning
        textBackMeaning.setText(formatMarkdown(correctMeaning));

        // Back: Hindi Meaning (gracefully hidden if missing)
        if (hindiMeaning != null && !hindiMeaning.trim().isEmpty()) {
            layoutBackHindi.setVisibility(View.VISIBLE);
            textBackHindi.setText(formatMarkdown(hindiMeaning.trim()));
        } else {
            layoutBackHindi.setVisibility(View.GONE);
        }

        // Back: Example sentence (gracefully hidden if missing)
        if (exampleSentence != null && !exampleSentence.trim().isEmpty()) {
            layoutBackExample.setVisibility(View.VISIBLE);
            textBackExample.setText(formatMarkdown("\"" + exampleSentence.trim() + "\""));
        } else {
            layoutBackExample.setVisibility(View.GONE);
        }
    }

    private void updateBottomButton() {
        int remaining = VocoAlarmScheduler.getPendingNotificationCount(this);

        if (!isTest && remaining > 0) {
            btnBottomAction.setText("Next Word →");
            btnBottomAction.setBackgroundResource(R.drawable.bg_btn_primary);
            btnBottomAction.setTextColor(Color.WHITE);
            textPendingBadge.setVisibility(View.VISIBLE);
            textPendingBadge.setText("+" + remaining + " more");
        } else {
            btnBottomAction.setText("Close");
            btnBottomAction.setBackgroundResource(R.drawable.bg_btn_primary);
            btnBottomAction.setTextColor(Color.WHITE);
            textPendingBadge.setVisibility(View.GONE);
        }
    }

    /**
     * Smooth 3D Flip Animation between Front and Back faces
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
                recordQuizStats(wordText);
            }
        });

        flipOut.start();
    }

    private void resetToFront() {
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
     * Pops and displays the next pending word from the queue.
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
        notificationId = nextNotifId;
        isTest = nextItem.optBoolean("isTest", false);

        resetToFront();
        populateCardData();
        updateBottomButton();
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

    private void recordQuizStats(String word) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_QUIZ_STATS, MODE_PRIVATE);
            int total = prefs.getInt(KEY_TOTAL_ANSWERED, 0) + 1;
            int correct = prefs.getInt(KEY_CORRECT_ANSWERED, 0) + 1;

            prefs.edit()
                .putInt(KEY_TOTAL_ANSWERED, total)
                .putInt(KEY_CORRECT_ANSWERED, correct)
                .putString(KEY_LAST_RESULT_WORD, word)
                .putBoolean(KEY_LAST_RESULT_CORRECT, true)
                .putLong(KEY_LAST_RESULT_TIME, System.currentTimeMillis())
                .apply();
        } catch (Exception ignored) {
        }
    }
}
