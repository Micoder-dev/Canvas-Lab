# Contributing to Canvas Lab

Thanks for your interest! Contributions are welcome.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run lint     # oxlint
```

Please make sure `npm run build` and `npm run lint` pass before opening a PR (CI runs both).

## Architecture

The editor and the code generators never talk directly — they share one
normalized **Shape Model** in `src/model/shapes.ts`.

- **Add an export target** → add a file under `src/codegen/` that reads the Shape Model, and wire it into `src/components/CodeColumn.tsx`.
- **Add a shape** → extend `src/model/shapes.ts`, render it in `src/components/Editor.tsx`, and handle it in each generator.
- **Add a shape preset** → add an entry to `src/model/presets.ts`.

## Pull requests

Keep PRs focused, describe the change, and include a screenshot for any UI work.

By contributing you agree your contributions are licensed under the [MIT License](LICENSE).
