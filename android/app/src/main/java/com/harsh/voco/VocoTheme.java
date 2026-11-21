package com.harsh.voco;

import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.HashMap;
import java.util.Map;

/**
 * Centralized theme definitions and dynamic styling engine for the Voco Native Popup.
 * Synchronized with src/services/theme.ts so all 8 themes share identical color tokens.
 */
public class VocoTheme {
    public final String id;
    public final String name;
    public final boolean isDark;

    public final int bgCard;
    public final int bgInner;
    public final int bgExample;
    public final int border;
    public final int borderSubtle;
    public final int textPrimary;
    public final int textSecondary;
    public final int textMuted;
    public final int accent;
    public final int accentHover;
    public final int accentSoft;
    public final int accentBorder;

    public VocoTheme(
        String id,
        String name,
        boolean isDark,
        String bgCardHex,
        String bgInnerHex,
        String bgExampleHex,
        String borderHex,
        String borderSubtleHex,
        String textPrimaryHex,
        String textSecondaryHex,
        String textMutedHex,
        String accentHex,
        String accentHoverHex,
        String accentSoftHex,
        String accentBorderHex
    ) {
        this.id = id;
        this.name = name;
        this.isDark = isDark;
        this.bgCard = Color.parseColor(bgCardHex);
        this.bgInner = Color.parseColor(bgInnerHex);
        this.bgExample = Color.parseColor(bgExampleHex);
        this.border = Color.parseColor(borderHex);
        this.borderSubtle = Color.parseColor(borderSubtleHex);
        this.textPrimary = Color.parseColor(textPrimaryHex);
        this.textSecondary = Color.parseColor(textSecondaryHex);
        this.textMuted = Color.parseColor(textMutedHex);
        this.accent = Color.parseColor(accentHex);
        this.accentHover = Color.parseColor(accentHoverHex);
        this.accentSoft = Color.parseColor(accentSoftHex);
        this.accentBorder = Color.parseColor(accentBorderHex);
    }

    private static final Map<String, VocoTheme> THEMES = new HashMap<>();

    static {
        // 1. Clean Light: White background, soft purple accents
        THEMES.put("clean-light", new VocoTheme(
            "clean-light", "Clean Light", false,
            "#FFFFFF", "#F8FAFC", "#F1F5F9",
            "#CBD5E1", "#E2E8F0",
            "#0F172A", "#334155", "#64748B",
            "#6554F5", "#5243E4", "#EEF2FF", "#C7D2FE"
        ));

        // 2. Midnight Dark: Dark charcoal background, purple accents
        THEMES.put("midnight", new VocoTheme(
            "midnight", "Midnight Dark", true,
            "#1B1D25", "#222530", "#15171E",
            "#3E4452", "#2E3341",
            "#F1F1F5", "#C8CADB", "#A5A8B5",
            "#8875F5", "#7562EB", "#2A2744", "#4B427E"
        ));

        // 3. Rose: Soft pink, cream and rose accents
        THEMES.put("rose", new VocoTheme(
            "rose", "Rose", false,
            "#FFFFFF", "#FFF1F2", "#FFE4E6",
            "#FDA4AF", "#FECDD3",
            "#881337", "#9F1239", "#BE123C",
            "#E11D48", "#BE123C", "#FFE4E6", "#FECDD3"
        ));

        // 4. Nature: Sage green, off-white and earthy accents
        THEMES.put("nature", new VocoTheme(
            "nature", "Nature", false,
            "#FFFFFF", "#F4F6F0", "#E8ECE1",
            "#CBD5C0", "#DCE3D2",
            "#14532D", "#166534", "#4D7C0F",
            "#16A34A", "#15803D", "#DCFCE7", "#BBF7D0"
        ));

        // 5. Ocean: Light blue, navy and white
        THEMES.put("ocean", new VocoTheme(
            "ocean", "Ocean", false,
            "#FFFFFF", "#F0F9FF", "#E0F2FE",
            "#BAE6FD", "#E0F2FE",
            "#0C4A6E", "#0369A1", "#0284C7",
            "#0284C7", "#0369A1", "#E0F2FE", "#BAE6FD"
        ));

        // 6. Sunset: Warm beige, orange and brown
        THEMES.put("sunset", new VocoTheme(
            "sunset", "Sunset", false,
            "#FFFFFF", "#FFFBEB", "#FEF3C7",
            "#FDE68A", "#FEF3C7",
            "#7C2D12", "#9A3412", "#C2410C",
            "#EA580C", "#C2410C", "#FFEDD5", "#FED7AA"
        ));

        // 7. Lavender: Soft lavender and violet
        THEMES.put("lavender", new VocoTheme(
            "lavender", "Lavender", false,
            "#FFFFFF", "#FAF5FF", "#F3E8FF",
            "#E9D5FF", "#F3E8FF",
            "#581C87", "#6B21A8", "#7E22CE",
            "#9333EA", "#7E22CE", "#F3E8FF", "#D8B4FE"
        ));

        // 8. AMOLED: Pure black with vibrant purple accents (elevated card surface for dark backgrounds)
        THEMES.put("amoled", new VocoTheme(
            "amoled", "AMOLED", true,
            "#050508", "#101015", "#16161D",
            "#333344", "#22222E",
            "#FFFFFF", "#D4D4D8", "#A1A1AA",
            "#A855F7", "#9333EA", "#27183C", "#4C2D75"
        ));
    }

    /**
     * Retrieves theme definition safely. Defaults to Clean Light for any unknown/null ID.
     */
    public static VocoTheme get(String themeId) {
        if (themeId != null) {
            // Handle backwards compatibility
            if ("light".equals(themeId)) return THEMES.get("clean-light");
            if ("dark".equals(themeId)) return THEMES.get("midnight");
            VocoTheme found = THEMES.get(themeId);
            if (found != null) {
                return found;
            }
        }
        return THEMES.get("clean-light");
    }

    /**
     * Creates a rounded rectangle GradientDrawable with configurable fill, stroke, and radius.
     */
    public static GradientDrawable createRoundedDrawable(
        int fillColor,
        int strokeColor,
        float strokeWidthDp,
        float radiusDp,
        float density
    ) {
        GradientDrawable gd = new GradientDrawable();
        gd.setShape(GradientDrawable.RECTANGLE);
        gd.setColor(fillColor);
        gd.setCornerRadius(radiusDp * density);
        if (strokeWidthDp > 0) {
            gd.setStroke((int) (strokeWidthDp * density), strokeColor);
        }
        return gd;
    }

    /**
     * Creates a button StateListDrawable with normal and pressed states.
     */
    public static StateListDrawable createButtonDrawable(
        int normalColor,
        int pressedColor,
        float radiusDp,
        float density
    ) {
        GradientDrawable normal = createRoundedDrawable(normalColor, 0, 0, radiusDp, density);
        GradientDrawable pressed = createRoundedDrawable(pressedColor, 0, 0, radiusDp, density);

        StateListDrawable sld = new StateListDrawable();
        sld.addState(new int[]{android.R.attr.state_pressed}, pressed);
        sld.addState(new int[]{}, normal);
        return sld;
    }

    /**
     * Applies full theme palette to all views in VocoQuizDialogActivity.
     */
    public void applyToDialog(VocoQuizDialogActivity activity) {
        float density = activity.getResources().getDisplayMetrics().density;

        // 1. Outer dialog card container
        View cardContainer = activity.findViewById(R.id.quiz_card_container);
        if (cardContainer != null) {
            cardContainer.setBackground(createRoundedDrawable(bgCard, border, 1.5f, 20f, density));
        }

        // 2. Top Header Tag ("VOCO FLASHCARD 📖")
        TextView textHeaderTag = activity.findViewById(R.id.text_header_tag);
        if (textHeaderTag != null) {
            textHeaderTag.setBackground(createRoundedDrawable(accentSoft, accentBorder, 1f, 10f, density));
            textHeaderTag.setTextColor(accent);
        }

        // 3. Header Pending Badge ("+N more")
        TextView textPendingBadge = activity.findViewById(R.id.text_pending_badge);
        if (textPendingBadge != null) {
            textPendingBadge.setTextColor(textMuted);
        }

        // 4. Header Dismiss 'X' Button
        ImageView btnDismissX = activity.findViewById(R.id.btn_dismiss_x);
        if (btnDismissX != null) {
            btnDismissX.setColorFilter(textMuted);
        }

        // 5. Flip Card Container
        View flipContainer = activity.findViewById(R.id.layout_flip_card);
        if (flipContainer != null) {
            flipContainer.setBackgroundColor(Color.TRANSPARENT);
        }

        // 6. Front Card Face
        LinearLayout cardFront = activity.findViewById(R.id.layout_card_front);
        if (cardFront != null) {
            cardFront.setBackground(createRoundedDrawable(bgInner, border, 1f, 16f, density));
        }

        // 7. Front Word Text
        TextView textWord = activity.findViewById(R.id.text_word);
        if (textWord != null) {
            textWord.setTextColor(textPrimary);
        }

        // 8. Front Question Text ("What does this word mean?")
        TextView textQuestion = activity.findViewById(R.id.text_question);
        if (textQuestion != null) {
            textQuestion.setTextColor(textMuted);
        }

        // 9. Front Flip Hint Pill
        View hintPill = activity.findViewById(R.id.layout_card_front);
        if (hintPill instanceof LinearLayout) {
            LinearLayout frontLayout = (LinearLayout) hintPill;
            int childCount = frontLayout.getChildCount();
            for (int i = 0; i < childCount; i++) {
                View child = frontLayout.getChildAt(i);
                if (child instanceof LinearLayout) {
                    child.setBackground(createRoundedDrawable(accentSoft, accentBorder, 1f, 20f, density));
                    LinearLayout pillLayout = (LinearLayout) child;
                    if (pillLayout.getChildCount() > 0 && pillLayout.getChildAt(0) instanceof TextView) {
                        ((TextView) pillLayout.getChildAt(0)).setTextColor(accent);
                    }
                }
            }
        }

        // 10. Back Card Face
        LinearLayout cardBack = activity.findViewById(R.id.layout_card_back);
        if (cardBack != null) {
            cardBack.setBackground(createRoundedDrawable(bgInner, border, 1f, 16f, density));
        }

        // 11. Back English Meaning Text
        TextView textBackMeaning = activity.findViewById(R.id.text_back_meaning);
        if (textBackMeaning != null) {
            textBackMeaning.setTextColor(textPrimary);
        }

        // 12. Back Hindi Meaning Text
        TextView textBackHindi = activity.findViewById(R.id.text_back_hindi);
        if (textBackHindi != null) {
            textBackHindi.setTextColor(textPrimary);
        }

        // 13. Back Example Container and Text
        View layoutBackExample = activity.findViewById(R.id.layout_back_example);
        if (layoutBackExample != null) {
            layoutBackExample.setBackground(createRoundedDrawable(bgExample, borderSubtle, 1f, 12f, density));
        }
        TextView textBackExample = activity.findViewById(R.id.text_back_example);
        if (textBackExample != null) {
            textBackExample.setTextColor(textSecondary);
        }

        // 14. Back Section Labels ("ENGLISH MEANING", "HINDI MEANING", "EXAMPLE", "👆 Tap card to flip back")
        if (cardBack != null) {
            styleLabelsRecursively(cardBack, textMuted);
        }

        // 15. Bottom Action Button (Next / Close)
        Button btnBottomAction = activity.findViewById(R.id.btn_bottom_action);
        if (btnBottomAction != null) {
            btnBottomAction.setBackground(createButtonDrawable(accent, accentHover, 12f, density));
            btnBottomAction.setTextColor(Color.WHITE);
        }
    }

    /**
     * Traverses back card views to style static label headers with theme textMuted color.
     */
    private void styleLabelsRecursively(View parent, int labelColor) {
        if (parent instanceof LinearLayout) {
            LinearLayout layout = (LinearLayout) parent;
            for (int i = 0; i < layout.getChildCount(); i++) {
                View child = layout.getChildAt(i);
                if (child instanceof TextView) {
                    TextView tv = (TextView) child;
                    CharSequence text = tv.getText();
                    if (text != null) {
                        String s = text.toString().trim();
                        if (s.equals("ENGLISH MEANING") || s.equals("HINDI MEANING") || s.equals("EXAMPLE") || s.contains("flip back")) {
                            tv.setTextColor(labelColor);
                        }
                    }
                } else if (child instanceof LinearLayout) {
                    styleLabelsRecursively(child, labelColor);
                }
            }
        }
    }
}
