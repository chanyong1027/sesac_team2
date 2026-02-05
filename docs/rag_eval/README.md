# RAG Evaluation Pack (Upload These Files)

This folder contains intentionally "tricky" documents to test your RAG pipeline:
- Conflicting policy versions (v1 vs v2)
- Short acronyms / typos (to exercise trigram fallback)
- Procedural content (runbooks) and factual content (pricing/limits)

## Suggested Flow
1. Start the app with `SPRING_PROFILES_ACTIVE=local` and `OPENAI_API_KEY` set.
2. Create org/workspace.
3. Upload files `01_...` through `06_...` to the same workspace.
4. Create a prompt version with the template in `prompt_template_grounded.md` and enable `ragEnabled=true`.
5. Run the queries in `test_queries.md` and verify:
   - Answer is grounded in retrieved context.
   - Source hints (`[source: ...]`) match the expected file.
   - Typos / short queries still retrieve via hybrid search.

