# CRM interaction and motion audit

## Policy now applied

| Area | Decision |
| --- | --- |
| Action buttons | Remove flow fill, shape morphing, sliding text and click scaling. Stable 9px corners; 120ms color/border feedback. |
| Icons | Prevent flex shrinking and button-level transforms. Preserve source artwork and original action icons. |
| Desktop sidebar | Explicit toggle only; no hover/focus expansion or animated page reflow. |
| Navigation labels | No horizontal hover movement. |
| Pages and calendars | Remove entry movement. Display content immediately. |
| Cards | Remove hover lift; retain restrained border/background feedback. |
| Branding and charts | Remove logo pulse/rotation and chart line reveal. |
| Mobile drawer | Retain 180ms slide because it communicates a real navigation state change. |
| Switches and chevrons | Retain small state-indicating movements, without resizing. |
| Loading | Preserve genuine loading feedback, not decorative pulsing. |
| Accessibility | Visible keyboard focus; reduced-motion disables transitions and limits animations. |

The final shared stylesheet is styles/motion-system.css. It intentionally wins over
legacy inline/theme rules. The unused FlowButton reference is not loaded by the app.

## Validation scope

Source audit covered stylesheet and inline keyframe/transition definitions and the
recent sidebar/FlowButton behavior. Desktop dashboard and lead-dialog rendering were
checked in-browser without saving records. Build and regression checks were run.
Tests protect the stable-motion policy against reintroducing the recent effects.

This is an interaction polish pass, not a certification that all CRM functionality
is production-ready. Full device/browser, screen-reader, performance and backend
security/reliability acceptance testing remains separate.
