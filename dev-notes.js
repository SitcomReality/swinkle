export const notes = `
## Developer Notes - Initial Setup

**Core Principles:**

*   **Modularity:** Break down the project into small, independent files. This makes updates manageable and reduces errors as the project grows.
*   **Conciseness:** Keep code and file sizes minimal. This is crucial for maintainability within the current development environment limitations. Modularity and clarity are higher priorities, but conciseness is important.
*   **Aesthetics & UX:** Aim for a unique, cohesive visual style and a smooth, intuitive user experience.
*   **Iterative Development:** Focus on specific immediate steps. Outline broader goals briefly but remain flexible to adapt the design as we progress. Avoid over-planning.

**Initial File Structure Plan:**

/
|-- index.html         # Main entry point
|-- style.css          # Global styles
|-- main.js            # Main script, loads modules
|-- config.js          # Configurable values (ESM module)
|-- dev-notes.js       # Developer notes module
|-- modules/           # Directory for JavaScript modules
|   |-- ui/            # UI related modules
|   |-- core/          # Core logic modules
|-- assets/            # Directory for static assets (SVGs, etc. - use inline where possible)
|   |-- svgs/

**Immediate Next Steps:**

1.  Establish the basic HTML structure (index.html).
2.  Create initial CSS for basic layout and dev notes display (style.css).
3.  Set up the main JavaScript entry point (main.js) and import map.
4.  Create this dev notes module (dev-notes.js) and ensure it's displayed on the page.
5.  Create the configuration file (config.js).

**Longer-Term Goals (Brief):**

*   Develop core interactive mechanics.
*   Refine the visual style and user interface.
*   Add engaging animations and transitions.

**Questions for User:**

*   What is the *very* basic concept or theme for this interactive experience? (e.g., a simple game, a data visualization, an abstract art piece?) Knowing this will help guide the initial structural decisions.
`;

export function loadDevNotes() {
    const container = document.getElementById('dev-notes-container');
    if (container) {
        container.textContent = notes;
        console.log("Dev notes loaded.");
    } else {
        console.error("Dev notes container not found!");
    }
}

