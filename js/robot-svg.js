// The robot Intent, drawn once and shared by the new tab page and the toolbar popup.
// Colours of the eyes, bulb and heart come from CSS (--tabi-eye).

export const ROBOT_SVG = `
<svg class="tabi-svg" viewBox="0 0 140 150" aria-hidden="true">
  <defs>
    <linearGradient id="tabiShell" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f7f9ff"/><stop offset="1" stop-color="#c9d2ea"/>
    </linearGradient>
    <linearGradient id="tabiVisor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1b2550"/><stop offset="1" stop-color="#0a0f26"/>
    </linearGradient>
    <radialGradient id="tabiGlow" cx=".5" cy=".5" r=".5">
      <stop offset="0" style="stop-color: var(--tabi-eye); stop-opacity: .9"/><stop offset="1" style="stop-color: var(--tabi-eye); stop-opacity: 0"/>
    </radialGradient>
  </defs>
  <!-- waving arm (behind the head) -->
  <g class="tabi-arm">
    <path d="M104 96 C 116 88, 122 74, 124 60" stroke="#c9d2ea" stroke-width="9" stroke-linecap="round" fill="none"/>
    <circle cx="124" cy="56" r="9" fill="url(#tabiShell)" stroke="#aab5d4" stroke-width="1.5"/>
  </g>
  <!-- body (mostly hidden behind the card) -->
  <rect x="38" y="92" width="64" height="58" rx="18" fill="url(#tabiShell)" stroke="#aab5d4" stroke-width="1.5"/>
  <circle class="tabi-heart" cx="70" cy="112" r="5"/>
  <!-- antenna -->
  <line x1="70" y1="24" x2="70" y2="10" stroke="#aab5d4" stroke-width="3" stroke-linecap="round"/>
  <circle class="tabi-bulb-glow" cx="70" cy="8" r="10" fill="url(#tabiGlow)"/>
  <circle class="tabi-bulb" cx="70" cy="8" r="5"/>
  <!-- ears -->
  <rect x="17" y="46" width="12" height="24" rx="6" fill="#b9c3df"/>
  <rect x="111" y="46" width="12" height="24" rx="6" fill="#b9c3df"/>
  <!-- head -->
  <g class="tabi-head">
    <rect x="24" y="22" width="92" height="72" rx="28" fill="url(#tabiShell)" stroke="#aab5d4" stroke-width="1.5"/>
    <rect x="34" y="34" width="72" height="46" rx="20" fill="url(#tabiVisor)"/>
    <ellipse cx="56" cy="42" rx="14" ry="4" fill="#fff" opacity=".12"/>
    <g class="tabi-eyes">
      <g class="tabi-eye-l"><ellipse class="tabi-eye" cx="55" cy="56" rx="7" ry="9"/><circle class="tabi-pupil" cx="57" cy="53" r="2.4" fill="#fff"/></g>
      <g class="tabi-eye-r"><ellipse class="tabi-eye" cx="85" cy="56" rx="7" ry="9"/><circle class="tabi-pupil" cx="87" cy="53" r="2.4" fill="#fff"/></g>
    </g>
    <!-- happy eyes (shown when cheering) -->
    <g class="tabi-happy" fill="none" stroke-width="4" stroke-linecap="round">
      <path d="M48 58 Q55 49 62 58"/><path d="M78 58 Q85 49 92 58"/>
    </g>
    <path class="tabi-mouth" d="M62 69 Q70 75 78 69" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="42" cy="70" r="4.5" fill="#ff8fb0" opacity=".45"/>
    <circle cx="98" cy="70" r="4.5" fill="#ff8fb0" opacity=".45"/>
  </g>
</svg>`;

// Little mitten hands that hold the top edge of the card (drawn in front of it).
export const HANDS_SVG = `
<svg viewBox="0 0 120 48" aria-hidden="true">
  <g class="tabi-finger"><rect x="84" y="14" width="10" height="26" rx="5" fill="#f1f4fc" stroke="#aab5d4" stroke-width="1.4"/></g>
  <g fill="url(#tabiHand)" stroke="#aab5d4" stroke-width="1.4">
    <rect x="18" y="2" width="26" height="20" rx="10"/>
    <rect x="76" y="2" width="26" height="20" rx="10"/>
  </g>
  <g stroke="#aab5d4" stroke-width="1.2" stroke-linecap="round" opacity=".7">
    <line x1="27" y1="11" x2="27" y2="19"/><line x1="35" y1="11" x2="35" y2="19"/>
    <line x1="85" y1="11" x2="85" y2="19"/><line x1="93" y1="11" x2="93" y2="19"/>
  </g>
  <defs><linearGradient id="tabiHand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f9ff"/><stop offset="1" stop-color="#d4dbef"/></linearGradient></defs>
</svg>`;
