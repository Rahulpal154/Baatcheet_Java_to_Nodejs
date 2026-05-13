# Java-to-Node.js Migration Plan: Baatcheet Backend

## Scope and checkpoint

This plan covers Phase 1 discovery for migrating `LatticeInnovations/Baatcheet-backend-monolithic` (Spring Boot) into `LatticeInnovations/baatcheet-nodejs-backend` (Node.js + TypeScript + Express). The frontend repositories `LatticeInnovations/baatcheet-admin-frontend` and `LatticeInnovations/baatcheet-frontend` were used only as API-contract references.

Per the migration playbook, this PR intentionally contains only this plan. No application code should be written until this plan is reviewed and the user confirms to proceed.

Source-of-truth schema dump: `Dump20260513.sql` (MySQL 8.0.45 dump, database `baatcheet`, 35 `CREATE TABLE` statements, 29 foreign-key constraints, seed/data inserts present in 33 tables).

## Architecture inventory

| Java Concept | Inventory | Node.js Equivalent |
|---|---|---|
| Framework | Spring Boot `3.3.2`, Java 17, monolithic app `in.lattice.baatcheet.BaatcheetApplication` | Express.js with TypeScript, `src/app.ts` for app setup and `src/server.ts` for entrypoint |
| Build tool | Gradle with `org.springframework.boot`, `io.spring.dependency-management`, SonarQube plugin | PNPM preferred; `tsc` strict mode, scripts for `build`, `start`, `dev`, `lint`, `format` |
| ORM / Data | Spring Data JPA + Hibernate, MySQL driver, 33 JPA entity classes plus many native `@Query` repository methods; Flyway migrations exist | Sequelize + `sequelize-typescript`; repositories/services should preserve native SQL through `sequelize.query()` where repository queries are complex |
| Auth | Spring Security stateless filter chain; JWT via `io.jsonwebtoken:jjwt`; custom `JwtFilter`, `JwtUtil`, `CookieBasedTrackingFilter`, `CookieManager`; public path allowlist; no role annotations found | `jsonwebtoken` with middleware preserving claims (`user_id`, `email_id`, `user_name`, `mobile_number`, `preferred_language`, `user_avatar`), cookie middleware preserving visitor/user auto-downgrade behavior; optional Passport only if future OAuth is introduced |
| Validation | Sparse Bean Validation: `@NotNull` on `Story.status`, `StoryMetaDTO.storyType`, `StoryMetaDTO.originalLanguage`, `Author.authorGenderId`; controllers use `@Valid` for stories/tags/triggers/authors | Zod schemas for request DTOs; reproduce Spring validation error object format for invalid requests |
| Middleware | `JwtFilter`, `CookieBasedTrackingFilter`, CORS via `@CrossOrigin`, Micrometer `Observation` around many controllers, `GlobalExceptionHandler` | Express auth middleware, cookie/visitor middleware, `cors`, request observation/logging middleware, centralized error middleware |
| Scheduled tasks | `VisitorServiceImpl.deleteInactiveVisitors()` has `@Scheduled(cron = "0 0 0 * * ?")`; deletes visitor records older than one week and cleans visitor story/trigger interactions | `node-cron` daily midnight job; preserve cleanup sequence and response-independent execution |
| Messaging | No RabbitMQ/Kafka listeners found | None in initial migration; do not add queues unless later code requires them |
| Caching | No `@Cacheable`/Spring cache annotations found | None initially |
| File uploads | `MultipartFile` in `MediaController`/`MediaServiceImpl`; upload path from `upload.path.url`; max file/request size 50 MB; serves `/media/file/{filename}` and download endpoint | Multer with 50 MB limit and filesystem storage path from env; static/streaming file responses with identical headers and URL shapes |
| Logging | SLF4J + Spring Boot logging config; file logs under `/home/baatcheet-logs/baatcheet.log`; root logging disabled, `in.lattice.baatcheet=DEBUG` | Pino recommended; keep log-level mapping and request-id correlation in cross-cutting PR |
| API docs | SpringDoc OpenAPI `2.2.0`; scans author, misc, story, user, recaptcha packages; path allowlist in `application.properties` | `swagger-jsdoc` + `swagger-ui-express`, generated from routers and DTO schemas; compare against Java Swagger once app is runnable |
| Transactions | `@Transactional` in user/reflection/tell-story services and delete/update repository methods | Sequelize managed transactions around multi-table user registration/update/delete, submission updates, note copy, reflections, and status changes |
| Exception handling | `@RestControllerAdvice` returns `{message,status}` for 404/400, `{ERROR}` for DB conflicts, validation field map, `{ERROR,DETAILS}` for generic 500; many controllers also return inline string/map errors | Express error middleware plus local controller handling where Java returns endpoint-specific bodies/statuses |
| Profiles / Config | Single `application.properties`, port `9090`, MySQL URL, JWT secret/expiration, recaptcha secret, upload path, actuator, SendGrid key, Spring Boot Admin URL; source repo currently contains secrets and must not be copied | `.env.example` only; `.env` gitignored. Variables: `PORT`, `DB_*`, `JWT_SECRET`, `JWT_EXPIRATION_MS`, `RECAPTCHA_SECRET`, `UPLOAD_PATH`, `SENDGRID_API_KEY`, optional admin URL/logging flags |
| Third-party libs | Lombok, Spring Security, Spring Data JPA, SpringDoc, Flyway, Apache POI, docx/OOXML, Apache Commons Text `LevenshteinDistance`, SendGrid, Twilio dependency, JSoup dependency, Micrometer/Actuator, Spring Boot Admin client | TypeScript types/interfaces, Sequelize/Umzug, `zod`, `multer`, `jsonwebtoken`, `axios`/`undici`, `exceljs`, `docx`, `fast-levenshtein`/`natural`, `@sendgrid/mail`, `twilio` only if used, `cheerio` only if JSoup behavior is used, `prom-client` if actuator metrics parity is required |

## Source modules and domain boundaries

- `author`: author profiles and author-community mapping.
- `misc`: locations, tags, triggers, media upload/download, merge/deactivate/activate flows.
- `story`: story metadata, details/sections, home feed, search, reactions, featured story ordering, TF-IDF/fuzzy search, SendGrid email notification service.
- `user`: user registration/login/profile, bookmarks, user-story interaction, admin/editor operations, reflections, notes, submissions, reports, feedback, document export.
- `visitor`: anonymous visitor creation, language, interaction cleanup.
- `recaptcha`: server-side Google reCAPTCHA validation.
- `config/exception/constants`: JWT, cookies, Spring Security, exception mapping, constants.

## Endpoint catalogue

Status-code note: endpoints that return `ResponseEntity.ok()`/`ResponseEntity.status(HttpStatus.OK)` return `200`; creation endpoints explicitly using `CREATED` return `201`; inline catches preserve Java endpoint-specific `404`, `409`, `403`, and `500` bodies. The Node migration must inspect each Java controller/service implementation during each slice and preserve the exact body for error branches.

### Author

| Method | Path | Request | Response / status |
|---|---|---|---|
| GET | `/authors` | `Authorization` header | `List<AuthorDTO>`, `200` |
| POST | `/authors` | `Authorization`; JSON `AuthorDTO`; `@Valid` | `AuthorDTO`, typically `200` |
| GET | `/authors/{authorId}` | `Authorization`; path `authorId` | `AuthorDTO`, `200`; not-found exceptions handled globally/inline |
| PUT | `/authors/{authorId}` | `Authorization`; path `authorId`; JSON `AuthorDTO` | `AuthorDTO`, `200` |
| DELETE | `/authors/{authorId}` | path `authorId` | `Map<String,String>`, `200` |

### Locations

| Method | Path | Request | Response / status |
|---|---|---|---|
| GET | `/locations/{type}` | path `type` | `List<LocationDTO>`, JSON, `200` |
| GET | `/locations/{type}/{locationId}` | path `type`, `locationId` | `List<LocationDTO>`, JSON, `200` |
| POST | `/locations` | JSON `LocationDTO` | `LocationDTO`, `200` |
| GET | `/locations/all` | none | `List<LocationDTO>`, `200` |
| GET | `/locations?locationId=` | query `locationId` | `LocationDTO`, `200` |

### Media

| Method | Path | Request | Response / status |
|---|---|---|---|
| GET | `/media/file/{filename}` | path filename | file resource response, `200` if found |
| GET | `/media/file/download/{filename}` | path filename | attachment download response, `200` if found |
| POST | `/media` | multipart field `file` | upload body from `MediaService`, 50 MB max |
| POST | `/media/file/cleanup` | none | cleanup response, may throw `IOException` |

### Tags

| Method | Path | Request | Response / status |
|---|---|---|---|
| GET | `/tags/all` | none | all active/inactive `Tags`, `200` |
| GET | `/tags` | none | active `Tags`, `200` |
| POST | `/tags` | JSON `TagsDTO`, `@Valid` | `Tags`, `200` |
| GET | `/tags/{id}` | path `id` | `Tags`, `200` |
| PUT | `/tags/{id}` | JSON `TagsDTO`; path `id` | text/string, `200` |
| PATCH | `/tags/deactivate/{id}` | path `id` | `ApiResponse`, `200` |
| PATCH | `/tags/activate/{id}` | path `id` | `ApiResponse`, `200` |
| GET | `/tags/admin` | `Authorization` | `List<TagListDTO>`, `200` |
| DELETE | `/tags/{tagId}` | `Authorization`; path `tagId` | `Tags`, `200` |
| POST | `/tags/merge` | JSON `MergeDTO` | `Tags`, `200` |

### Triggers

| Method | Path | Request | Response / status |
|---|---|---|---|
| GET | `/triggers/all` | none | all active/inactive `Triggers`, `200` |
| GET | `/triggers` | none | active `Triggers`, `200` |
| POST | `/triggers` | JSON `TriggersDTO`, `@Valid` | `Triggers`, `200` |
| GET | `/triggers/{id}` | path `id` | `Triggers`, `200` |
| PUT | `/triggers/{id}` | JSON `TriggersDTO`; path `id` | text/string, `200` |
| PATCH | `/triggers/deactivate/{id}` | path `id` | `ApiResponse`, `200` |
| PATCH | `/triggers/activate/{id}` | path `id` | `ApiResponse`, `200` |
| GET | `/triggers/admin` | `Authorization` | `List<TriggerListDTO>`, `200` |
| DELETE | `/triggers/{triggerId}` | `Authorization`; path `triggerId` | `Triggers`, `200` |
| POST | `/triggers/merge` | JSON `MergeDTO` | `Triggers`, `200` |

### reCAPTCHA

| Method | Path | Request | Response / status |
|---|---|---|---|
| POST | `/recaptcha/validate` | request param `g-recaptcha-response`; request IP | `Map<String,String>`, `200`; Java uses `RestTemplate` to Google verify endpoint |

### Homepage / feed

| Method | Path | Request | Response / status |
|---|---|---|---|
| GET | `/homepage/{pageIndex}` | optional `Authorization`; path `pageIndex`; optional query `visitorId` | feed payload, `200` |
| GET | `/homepage/tag/{tagId}` | optional `Authorization`; path `tagId`; optional `visitorId` | feed payload, `200` |
| GET | `/homepage/saved` | `Authorization`; request context | `SavedAndReactedDTO`, `200` |
| POST | `/homepage/{pageIndex}` | optional `Authorization`; JSON `FilterPayloadDTO`; optional `visitorId` | filtered feed payload, `200` |
| GET | `/homepage/search?query=&pageIndex=&visitorId=` | optional `Authorization`; query params | search result object, `200` |

Frontend note: `baatcheet-frontend` contains older calls such as `/homepage/saved/{userId}` and `/stories/next/{userId}`, while current Java controllers expose token/visitor-based forms. During implementation, verify whether compatibility shims are needed or frontend is stale.

### Stories

| Method | Path | Request | Response / status |
|---|---|---|---|
| POST | `/stories` | `Authorization`; JSON `StoryMetaDTO`, `@Valid` | `StoryMetaDTO`, `200` |
| PUT | `/stories/{storyId}` | `Authorization`; JSON `StoryMetaDTO`; path `storyId` | `StoryMetaDTO`, `200` |
| GET | `/stories` | optional `Authorization` | `List<StoryListDTO>`, `200` |
| GET | `/stories/meta` | optional `Authorization` | `List<StoryMetaDTO>`, `200` |
| DELETE | `/stories/{storyId}` | `Authorization`; path `storyId` | `StoryMetaDTO`, `200` |
| GET | `/stories/{storyId}` | optional `Authorization`; path `storyId` | `StoryMetaDTO`, `200` |
| PUT | `/stories/status/{storyId}/{status}` | `Authorization`; path `storyId`, `StoryStatus` | `ApiResponse`, `200` |
| PUT | `/stories/readtime/{storyId}/{readTime}` | path `storyId`, `readTime` | string, `200` |
| POST | `/stories/react/{sectionId}/{reactionType}` | `Authorization`; request context | reaction body, `201`/`409`/`404` depending service branch |
| PUT | `/stories/react/{sectionId}/{reactionType}` | `Authorization`; request context | reaction body, `200`/errors |
| GET | `/stories/saved` | `Authorization` | saved-story payload, `200` |
| GET | `/stories/react/{reactionType}` | `Authorization`; path `reactionType` | reaction list, `200` |
| DELETE | `/stories/react/{sectionId}` | `Authorization`; path `sectionId` | delete response, `200` |
| GET | `/stories/featured` | optional `Authorization` | `List<FeaturedStoryDto>`, `200` |
| PATCH | `/stories/featured` | JSON `List<FeaturedStoryDto>` | `Map<String,String>`, `200` |
| GET | `/stories/next?currentStoryId=&visitorId=` | optional `Authorization`; request context | next-stories payload, `200` |

### Story details

| Method | Path | Request | Response / status |
|---|---|---|---|
| POST | `/story-details/{storyId}` | `Authorization`; JSON `StoryDetailUpload` | `StoryDetails`, `200` |
| PUT | `/story-details/{storyId}/{storyDetailsId}` | `Authorization`; JSON `StoryDetailUpload` | `StoryDetails`, `200` |
| GET | `/story-details/{storyId}` | optional `Authorization`; optional `visitorId` | admin story details object, `200` |
| GET | `/story-details/info/{storyId}` | optional `Authorization`; optional `visitorId` | user story details payload, `200` |
| PUT | `/story-details/other/{storyDetailsId}?language=` | path `storyDetailsId`; query `RegionalLanguage` | `AdminStoryDetailsDTO`, `200` |
| DELETE | `/story-details/{storyDetailsId}` | path `storyDetailsId` | `StoryDetails`, `200` |

### Admin

| Method | Path | Request | Response / status |
|---|---|---|---|
| GET | `/admin/users/{userId}/stories` | path `userId` | user-story/admin detail object, `200` |
| GET | `/admin/authors/{authorId}/metrics` | `Authorization`; path `authorId` | `AuthorDetailDTO`, `200` |
| GET | `/admin/submission/{submissionId}` | optional `Authorization`; request context | `SubmissionDTO`, `200` |
| PATCH | `/admin/{submissionId}/status` | JSON `UserSubmission` | text/string, `200` |
| GET | `/admin/submission` | `Authorization` | `List<SubmissionAdminDTO>`, `200` |
| GET | `/admin/users` | none | `List<UserListDTO>`, `200` |
| PATCH | `/admin/participantStatus/{userId}?isParticipant=` | path `userId`; query boolean | `Map<String,String>`, `200` |
| GET | `/admin/allFeedback` | none | `List<UsersFeedbackResponseDto>`, `200` |
| GET | `/admin/allFeedback/{userId}` | path `userId` | `List<UsersFeedbackResponseDto>`, `200` |
| GET | `/admin/downloadReport` | none | Excel bytes, likely `200`, Apache POI workbook |

### Editors

| Method | Path | Request | Response / status |
|---|---|---|---|
| POST | `/editors` | JSON `EditorRequestDto` | `Editor`, `200` |
| GET | `/editors` | `Authorization` | editor list object, `200` |
| GET | `/editors/{editorId}` | `Authorization`; path `editorId` | editor object, `200`; string `Editor not found`, `404` |
| PATCH | `/editors` | `Authorization`; JSON `Editor` | `Map<String,String>`, `200` |

### My Story

| Method | Path | Request | Response / status |
|---|---|---|---|
| POST | `/my-story` | optional `Authorization`; JSON `MyStoryDto`; optional `visitorId` | story/submission payload, `200`/`404`/`500` |
| PUT | `/my-story?submissionId=` | optional `Authorization`; JSON `MyStoryDto`; query `submissionId` | story/submission payload, `200`/`500` |

### Reflections, notes, and submissions

| Method | Path | Request | Response / status |
|---|---|---|---|
| POST | `/reflections/questions` | JSON `QuestionMaster` | `QuestionMaster`, `200` |
| GET | `/reflections/questions/{module}` | optional `Authorization`; optional `visitorId` | questions payload, `200` |
| GET | `/reflections/landingPage/{userId}` | path `userId` | landing payload, `200` |
| POST | `/reflections/notes` | JSON `PromptDTO`; request context | note/prompt payload, `200` |
| GET | `/reflections/notes/{userId}` | path `userId` | `NoteDTO`, `200` |
| DELETE | `/reflections/notes/{promptId}` | path `promptId` | `Map<String,String>`, `200` |
| POST | `/reflections/options` | JSON `QuestionOptionDTO` | `QuestionOptionDTO`, `200` |
| GET | `/reflections/options` | none | `List<QuestionOptionDTO>`, `200` |
| GET | `/reflections/metrics` | `Authorization` | `ReflectionMetricsDTO`, `200` |
| GET | `/reflections/author/{authorId}` | `Authorization`; path `authorId` | `AuthorDTO`, `200` |
| PUT | `/reflections/submissions/details/{submissionId}` | optional `Authorization`; JSON `UserSubmissionDTO`; request context | submission object, `200` |
| GET | `/reflections/submissions/{submissionId}` | optional `Authorization`; request context | `SubmissionDTO`, `200` |
| POST | `/reflections/copy/notes/{noteId}` | `Authorization`; path `noteId` | copy payload, `200` |
| POST | `/reflections/submissions` | optional `Authorization`; optional JSON `MyStoryDto`; optional `visitorId` | create-submission payload, `200` |
| GET | `/reflections/submissions` | optional `Authorization`; optional `visitorId` | user/visitor submissions payload, `200` |
| POST | `/reflections/submissions/{submissionId}/submit` | optional `Authorization`; request context | `ApiResponse`, `200`/`404`/`403`/`500` |
| POST | `/reflections/submissions/{submissionId}/draft` | optional `Authorization`; request context | `ApiResponse`, `200`/`404`/`403`/`500` |
| PUT | `/reflections/submissions/reorder` | JSON `List<SubmissionPromptDTO>` | reordered prompts, `200` |
| GET | `/reflections/submissions/all` | optional `Authorization` | `List<SubmissionDTO>`, `200` |
| POST | `/reflections/submissions/feedbacks?submissionId=&visitorId=` | JSON `FeedbackDTO`; optional `Authorization` | `FeedbackDTO`, `200` |
| GET | `/reflections/submissions/prompts` | none | `List<SubmissionPromptDTO>`, `200` |
| DELETE | `/reflections/submissions/prompts/{promptId}` | path `promptId` | `ApiResponse`, `200` |
| POST | `/reflections/story-reflections/{storyId}` | `Authorization`; JSON `ReflectionDTO`; request context | reflection payload, `200` |
| GET | `/reflections/story-reflections/{userId}/{storyId}` | `Authorization`; path ids | `List<ReflectionDTO>`, `200` |
| GET | `/reflections/story-reflections/{id}` | path `id` | `StoryBasedReflections`, `200` |
| GET | `/reflections/submission/exist` | `Authorization` | existence payload, `200` |
| DELETE | `/reflections/submission/override` | `Authorization` | override payload, `200` |
| POST | `/reflections/download/submissionStory` | optional `Authorization`; JSON `ReportDTO`; optional `visitorId` | Word document `InputStreamResource`, `200` |

Frontend note: the user frontend contains older patterns such as `/reflections/{userId}/submissions`, `/reflections/download/submissionStory/{userId}`, and `/reflections/copy/notes/{userId}`. Treat this as a contract-risk item and verify against deployed API or decide whether to preserve alias routes in Node without changing the canonical Java routes.

### Users

| Method | Path | Request | Response / status |
|---|---|---|---|
| POST | `/users/register` | JSON `UserEntity` | `UserResponseDto`, `201`; `409` duplicate; `404` not found |
| GET | `/users` | none | user list object, `200` |
| GET | `/users/{userId}` | path `userId` | `UserDTO`, `200` |
| PUT | `/users/{userId}` | `Authorization`; JSON `UserEntity` | `UserEntity`, `200`; `409`; `404` |
| DELETE | `/users/{userId}` | path `userId` | `Map<String,String>`, `200`; `500` map on error |
| POST | `/users/login` | JSON `UserLoginRequestDto`; response cookie context | `ExistingUserDTO`, `200` |
| PATCH | `/users/language` | JSON `UserEntity` | `Map<String,String>`, `200` |
| POST | `/users/bookmark/{storyId}` | `Authorization`; path `storyId`; request context | `SavedStoryEntity`, `201`; `409` duplicate; `404` story/user; `500` |
| DELETE | `/users/bookmark/{userId}/{storyId}` | path ids (method only uses `storyId`) | `Map<String,String>`, `200` |
| GET | `/users/search?query=&pageIndex=&visitorId=` | optional `Authorization` | search object, `200` |
| POST | `/users/mark-as-read/{storyId}?visitorId=` | optional `Authorization`; path `storyId` | void response |
| GET | `/users/metrics` | `Authorization` | account details object, `200` |
| DELETE | `/users/resetInteraction/{userId}` | path `userId` | `Map<String,String>`, `200` |
| DELETE | `/users/clearReflectionAndNotes/{userId}` | path `userId` | `Map<String,String>`, `200` |
| GET | `/users/submission/{submissionId}` | optional `Authorization`; request context | `SubmissionDTO`, `200` |

### Feedback

| Method | Path | Request | Response / status |
|---|---|---|---|
| POST | `/feedback` | JSON `UsersFeedback` | `UsersFeedbackDto`, `200` |
| GET | `/feedback?pageLimit=&searchKeyword=` | query optional | `List<UsersFeedbackResponseDto>`, `200` |
| GET | `/feedback/{userId}?offset=` | path `userId`; query offset default `0` | `List<UsersFeedbackResponseDto>`, `200` |

### Visitor

| Method | Path | Request | Response / status |
|---|---|---|---|
| POST | `/visitor` | none | map with visitor id / message, `201` or `500` |
| PATCH | `/visitor/language` | JSON `VisitorDTO` | success payload, `200`; string `404` or `500` on errors |

## Schema analysis

The SQL dump is the schema source of truth for Sequelize models and migrations. It includes table data; the migration should keep `db/schema.sql` as a reference and generate explicit migrations without relying on `sequelize.sync()`.

### Tables, keys, and entity mapping

| SQL table | Primary key / notable constraints | Java entity mapping | Migration notes |
|---|---|---|---|
| `author_community_map` | PK `ac_id`; FK `author_id -> authors.author_id` | `author.entity.Community` | Belongs to author; community enum stored as tinyint plus free-text name |
| `authors` | PK `author_id`; FK `user_id -> user_master.user_id` | `author.entity.Author` | DDL has both `users_id` and `user_id`; model must preserve both if present |
| `editor_master` | PK `editor_id` | `user.entity.Editor` | boolean flags are MySQL `bit(1)` |
| `flyway_schema_history` | PK `installed_rank`, index `success` | Flyway internal | Do not model as domain entity; preserve only if reproducing exact imported schema |
| `location_master` | PK `location_id` | `misc.entity.Location` | hierarchical location via `parent_id`, `type` tinyint |
| `media_links` | FK `feedback_id -> submission_feedback.feedback_id`; no explicit PK in dump | collection table | Sequelize migration must preserve missing PK behavior unless intentionally normalized with approval |
| `note_prompts` | PK `prompt_id`; FKs to `question_master`, `user_notes` | `user.entity.NotePrompts` | DDL has `question_module`, `question_type`, Hindi fields; map enum tinyints |
| `question_master` | PK `question_id` | `user.entity.QuestionMaster` | placeholder and Hindi text columns exist |
| `question_option` | PK `option_id`; FK `question_id`; FK `reflection_id -> story_reflections` | `user.entity.QuestionOption` | Optional relation to reflection |
| `section_master` | PK `section_id`; FK `story_details_id -> story_details` | `story.entity.Section` | `section_content` is `text`; section type tinyint |
| `story_based_reflections_media_link` | FK to `story_reflections`; no explicit PK | collection table | Preserve as join/element collection table |
| `story_details` | PK `story_details_id`; FK `story_id -> story_master.id` | `story.entity.StoryDetails` | language tinyint, regional title/desc/audio |
| `story_master` | PK `id` | `story.entity.Story` | Stores denormalized `author_name`, published flags, story metadata, featured sequence |
| `story_reflections` | PK `reflection_id`; FKs to question/user | `user.entity.StoryBasedReflections` | Has `story_id` without FK in dump; preserve nullable columns |
| `story_tag_map` | PK `ut_id`; FK `story_id -> story_master.id` | `story.entity.StoryTag` | tag id is denormalized/no FK in dump |
| `story_trigger_map` | PK `ut_id`; FK `story_id -> story_master.id` | `story.entity.StoryTrigger` | trigger id denormalized/no FK in dump |
| `story_type_map` | PK `st_id`; FK `story_id -> story_master.id` | `story.entity.StoryTypeMap` | story type tinyint |
| `submission_author` | PK `author_id`; FKs to `user_master`, `user_submission` | submission author object | Distinct from `authors`; used for user submissions |
| `submission_feedback` | PK `feedback_id`; FKs to question/submission | `user.entity.SubmissionFeedback` | default timestamps `'2023-11-01 00:00:00'` must be preserved |
| `submission_feedback_media_link` | FK to `submission_feedback`; no explicit PK | collection table | Preserve no-PK table structure |
| `submission_prompts` | PK `sp_id`; FKs to question/submission | `user.entity.SubmissionPrompts` | answer text `varchar(5000)`, media link, ordering |
| `tag_master` | PK `id` | `misc.entity.Tags` | active flag bit(1), Hindi description |
| `tfidf_scores` | PK `id` | `story.entity.TFIDFScore`, `story.entity.NgramScore` | Both Java classes map to same table; resolve duplicated class intent during story/search slice |
| `trigger_master` | PK `id` | `misc.entity.Triggers` | active flag bit(1), Hindi description |
| `user_community_map` | PK `uc_id`; FK `user_id -> user_master.user_id` | `user.entity.CommunityUserMapping` | community enum tinyint/name |
| `user_master` | PK `user_id` | `user.entity.UserEntity` | `user_gender_id` is MySQL enum; DDL has `preferred_language`, `is_participant`, location fields |
| `user_notes` | PK `note_id`; FK `user_id -> user_master.user_id` | `user.entity.UserNotes` | Hindi and English draft/media columns |
| `user_reaction_map` | PK `reaction_id`; unique `(user_id, section_id)`; FK `section_id -> section_master` | `story.entity.UserReaction` | DDL lacks FK to `user_master`; preserve unique constraint |
| `user_story_interaction` | PK `user_story_interaction_id` | `user.entity.account.UserStoryInteraction` | Has visitor support and `mark_as_read` tinyint default `0` |
| `user_story_map` | PK `id` | `user.entity.SavedStoryEntity` | Bookmark/reaction table; no FKs in dump |
| `user_submission` | PK `submission_id`; FKs `author_id -> authors`, `user_id -> user_master` | `user.entity.UserSubmission` | DDL links to `authors`, but code also uses `submission_author`; verify relationship during slice |
| `user_tag_map` | PK `ut_id`; FK `user_id -> user_master` | `user.entity.TagsUserMap` | tag id/name denormalized |
| `user_trigger_map` | PK `utrigger_id`; FK `user_id -> user_master` | `user.entity.TriggersUserMap` | visitor id present for anonymous flows |
| `users_feedback` | PK `feedback_id` | `user.entity.UsersFeedback` | created_at non-null `datetime(6)` |
| `visitor_master` | PK `id` | `visitor.entity.Visitor` | visitor UUID string and `preferred_language`; `created_at` added by Flyway |

### Views and migrations present in Java repo

Java Flyway migrations define additional database objects/changes that must be included in Node migrations if absent from the schema dump:

- `V2__create_view.sql`: `story_views`
- `V3__create_story_views.sql`: related story view changes
- `V4__get_location.sql`: location helper SQL
- `V5__update_media_file_field_size.sql`: media field size change
- `V6__add_column_created_at_in_visitor_master.sql`: visitor timestamp
- `V7__questions_add_for_submission_module.sql`: question seed/update data
- `V8__story_description_type_change.sql`: story description type change
- `V9__add_visitor_id_column.sql`: visitor id additions

During Phase 2/3 migration generation, compare the dump against these migrations. The dump already includes at least `visitor_master.created_at`, `user_story_interaction.visitor_id`, and text-sized story description changes; views/procedures may need explicit recreation because MySQL dumps often omit or separate view definitions.

### JPA-vs-DDL discrepancies to resolve

- `NgramScore` and `TFIDFScore` both map to `tfidf_scores`; determine whether one is unused or whether `field_type` differentiates them before creating TypeScript models.
- SQL dump contains collection tables with no explicit primary key (`media_links`, `story_based_reflections_media_link`, `submission_feedback_media_link`); Sequelize models/migrations must allow this or use raw migrations rather than standard model assumptions.
- Some IDs are denormalized without SQL FKs (`tag_id`, `trigger_id`, `story_id` in reflections, `user_id` in reaction/bookmark maps). Do not add new constraints without approval.
- `user_master.user_gender_id` is an SQL `ENUM`, while many other enums are stored as Java ordinal `tinyint`. TypeScript must encode both patterns exactly.
- Several timestamp defaults are sentinel values (`'2023-11-01 00:00:00'`) rather than current timestamps; preserve these defaults in migrations.
- Source `application.properties` includes live credentials/secrets. Do not copy them. Use `.env.example` placeholders only.

## Frontend API contract observations

### Admin frontend

The admin Angular app uses `environment.base_url` with endpoints matching the admin/content management API:

- `/users/login`
- `/stories`, `/stories/status/{id}/{status}`, `/stories/readtime/{id}/{readTime}`, `/stories/featured`
- `/authors`, `/admin/authors/{id}/metrics`
- `/countries`, `/states/{id}/cities` constants exist, but the current Java API uses `/locations/{type}` and `/locations/{type}/{locationId}`; verify stale constants before implementation.
- `/tags`, `/tags/admin`, `/tags/merge`
- `/triggers`, `/triggers/admin`, `/triggers/merge`
- `/story-details/{storyId}`, `/story-details/{storyId}/{storyDetailsId}`, `/story-details/other/{storyDetailsId}?language=`
- `/admin/submission`, `/admin/submission/{id}`, `/admin/{id}/status`
- `/media`
- `/editors`
- `/admin/users`, `/admin/users/{userId}/stories`

### User frontend

The user Angular app uses token-bearing helper methods and exercises public/mobile flows:

- Login/signup/profile: `/users/login`, `/users/register`, `/users/{id}`, `/users/{id}/metrics`, `/users/language`, `/users/resetInteraction/{id}`, `/users/clearReflectionAndNotes/{id}`
- Feed/search: `/homepage/...`, `/homepage/search`, `/homepage/tag/{tagId}`, `/users/search`
- Story details/reactions/bookmarks: `/story-details/...`, `/stories/react/...`, `/stories/next...`, `/users/bookmark/...`, `/users/mark-as-read/{storyId}`
- Reflections/submissions: `/reflections/questions/{module}`, `/reflections/metrics`, `/reflections/submissions...`, `/reflections/submissions/prompts`, `/reflections/submissions/feedbacks`, `/reflections/story-reflections...`, `/reflections/submission/exist`, `/reflections/submission/override`, `/reflections/download/submissionStory`
- Media upload: `/media` multipart
- Feedback: `/feedback`

Contract risk: several user-frontend calls include path `userId` segments where the monolithic Java controller now expects token-derived identity and no user-id path. Preserve Java canonical routes first, but decide during implementation whether harmless alias routes are required for deployed frontend compatibility.

## Java-specific patterns and migration handling

- Java Streams are common in user/submission/story services and map to `Array.map/filter/reduce/sort`.
- `Optional<T>` appears heavily in repositories/services and maps to `T | null` with explicit null checks.
- `@Transactional` methods must wrap all dependent writes/deletes in Sequelize transactions.
- Native SQL queries are extensive (277 `@Query`/`@Modifying` matches). Complex report/search/feed queries should be ported as raw SQL first for parity, then refactored only after tests/approval.
- Apache POI workbook export in `/admin/downloadReport` maps to `exceljs`.
- Apache POI `XWPFDocument` submission-story export maps to `docx` or equivalent stream response.
- TF-IDF and fuzzy search use Apache Commons Text `LevenshteinDistance`; preserve ranking semantics with a tested JS Levenshtein implementation.
- SendGrid Java service maps to `@sendgrid/mail`; the Twilio dependency is present but no concrete usage was found in discovery.
- reCAPTCHA uses a server-side HTTP POST/GET through `RestTemplate`; implement with `axios` or `undici`, preserving error handling.
- `@Async` appears in `TFIDFProcessor.processStoryTFIDF()`; use an async service/background job, not blocking request handlers.

## Recommended vertical slice plan

1. **Scaffold and database foundation**: TypeScript/Express app, health check, `.env.example`, lint/format, Umzug, MySQL Docker Compose, schema reference, base error/auth/cookie middleware skeleton.
2. **Core config/auth/user identity**: JWT/cookies/security public-route behavior, `user_master`, user-community/tag/trigger maps, registration/login/profile/language endpoints.
3. **Reference data**: locations, tags, triggers, merge/activate/deactivate/admin list endpoints.
4. **Author management**: authors and author-community maps, admin author metrics dependencies.
5. **Story metadata and details**: story master/details/sections/type/tag/trigger maps, story CRUD, read time, status, other-language details.
6. **Media and file serving**: upload/download/cleanup with Multer/filesystem path parity.
7. **Homepage, search, recommendations, interactions**: home feed, tag feed, TF-IDF/fuzzy search, next stories, mark-as-read, visitor-aware story interaction.
8. **Reactions and bookmarks**: user reaction map, saved stories, reacted sections, unique-constraint behavior.
9. **Reflections and notes**: question master/options, notes/prompts, story reflections, reflection metrics.
10. **Submissions / tell-story flow**: submission creation, basic details, prompt reorder/delete, feedback, submit/draft, copy notes, override/existence checks, visitor restrictions.
11. **Admin/editor/reporting**: editors, admin submission/user lists, participant status, feedback reports, Excel download, Word document export.
12. **Visitor and scheduled cleanup**: visitor creation/language and daily inactive visitor cleanup.
13. **Cross-cutting parity**: logging, OpenAPI, metrics/health equivalent to actuator, SendGrid notifications, final docs and deployment handover.

Dependency rationale: auth/user and reference data are needed by authors/stories; stories and media are needed before feeds; feeds/reactions/bookmarks are needed before reflection/submission flows; admin reporting depends on users/stories/submissions.

## Phase 2 scaffolding decisions proposed after approval

- Use Node 20 and PNPM.
- Use `sequelize-typescript` decorators and `umzug` migrations.
- Use MySQL driver `mysql2` because the dump and Java datasource are MySQL 8.
- Keep `db/schema.sql` as a copied reference only if user approves storing the provided dump in repo; otherwise store only generated migrations. The dump contains production-like data inserts and should be reviewed before committing.
- Add `GET /health -> 200` returning app status and no DB-required startup dependency.
- Add `.env.example` with placeholders, never real values from source `application.properties`.
- Add Docker Compose with MySQL 8; Redis/RabbitMQ not needed unless a later slice introduces queues/cache.

## Open questions for human review

1. Should the SQL dump data inserts be committed as seeders, or should only table/view schema be migrated?
2. Should Node preserve older frontend alias routes that include path `userId`, or should frontends be updated later to use the Java canonical routes?
3. Should `flyway_schema_history` be reproduced in the target schema, or omitted as Java/Flyway internal metadata?
4. Should notification integrations (SendGrid and any future Twilio use) be implemented with real providers during migration, or stubbed behind interfaces until deployment secrets are provisioned?
5. Is exact compatibility with the current deployed Java API more important than strict compatibility with the checked-in frontend code where they differ?
