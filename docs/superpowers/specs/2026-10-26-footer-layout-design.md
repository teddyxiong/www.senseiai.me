# Footer Layout Design

## Intent

Make the footer visually balanced and more compact by removing the large gap between the brand content and the About Us links.

## Selected approach

Use one responsive three-column row: logo on the left, description and Discord link in the center, and About Us links on the right. Keep the copyright in its own bottom row. On small screens, stack the same content in that order.

## Alternatives considered

- Two columns: more compact, but leaves the visual weight concentrated on the left.
- Keep two rows and reduce spacing: smallest CSS change, but does not fix the disconnected composition.

## Constraints

- Preserve all existing copy, links, colors, hover behavior, and accessibility attributes.
- Add no dependencies or new components.
- Change only the shared default/home footer layout.

