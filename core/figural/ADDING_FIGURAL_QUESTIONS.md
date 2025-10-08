# Adding Figural Sequence Questions

The Figural Sequences module reads its content from `data/core/fig.json`. Each entry in the `questions` array represents one puzzle with its own artwork, answer options, hints, and explanations.

Follow these steps to add another question:

1. **Prepare artwork**
   * Create the SVG (or PNG) that shows the full puzzle prompt and save it in `core/figural/samples/` (or another folder). Reference it with a relative path in `question_image`.
   * For every blank the learner must solve (e.g., Image 1, Image 2), create separate option images and store them alongside the question artwork. You may reuse assets across questions.

2. **Add the JSON entry**
   * Open `data/core/fig.json` and append a new object inside the `questions` array. Use a unique `id` so the app can track selections.
   * Fill these top-level fields:
     * `prompt`: Short instructions that appear above the artwork.
     * `question_image`: Relative path to the puzzle artwork file.
     * `hint`: Optional text shown when the learner presses **Show hint**.
     * `explanation`: Longer breakdown revealed after the learner toggles **Show explanation**.

3. **Describe each target blank**
   * Inside `targets`, create one object per blank (e.g., `Image 1`, `Image 2`). Each object must include:
     * `id`: Unique within the question (e.g., `image-1`).
     * `label`: Friendly name displayed in the UI.
     * `correct_option_id`: The `id` of the right answer from that blank's option list.
     * `answer_explanation`: One-line justification that appears under the explanation toggle.
     * `options`: An array of 2–4 answer choices. Every option needs an `id`, `label`, and `image_url` pointing to the option artwork. You can add `alt` text or `caption` for accessibility.

4. **Validate**
   * Ensure paths are relative to `core/figural/index.html` (for example `./samples/my-question.svg`).
   * Keep the JSON valid—check for trailing commas and matching braces.
   * To preview, run a local server (e.g., `python -m http.server 8000`) from the repository root and open `/core/figural/` in your browser. The app will randomly pick up to 20 questions each load, including your new one.

## Minimal template

```json
{
  "id": "fig-unique-id",
  "prompt": "Write the short instructions here.",
  "question_image": "./samples/my-question.svg",
  "hint": "Optional hint text.",
  "targets": [
    {
      "id": "image-1",
      "label": "Image 1",
      "correct_option_id": "matrix-2",
      "answer_explanation": "Why matrix 2 is correct.",
      "options": [
        { "id": "matrix-1", "label": "Matrix 1", "image_url": "./samples/my-question-A1.svg" },
        { "id": "matrix-2", "label": "Matrix 2", "image_url": "./samples/my-question-A2.svg" },
        { "id": "matrix-3", "label": "Matrix 3", "image_url": "./samples/my-question-A3.svg" }
      ]
    }
  ],
  "explanation": "Full breakdown of the logic behind the solution."
}
```

Add commas between question objects when inserting multiple entries.
