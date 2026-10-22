# DoveRunner Forensic Watermark CDN Embedder Sample for AWS Lambda@Edge

> **A reference implementation.** Fork this sample and adapt it to your own delivery setup — the
> function you deploy is yours to operate.
>
> - **Docs**: https://docs.doverunner.com/content-security/forensic-watermarking/embedding/
> - **Support**: https://doverunner.zendesk.com
> - **Security**: report a vulnerability through support
> - **Copyright**: ⓒ 2026 DoveRunner. All Rights Reserved. (doverunner.com)

This project serves as a sample implementation for embedding forensic watermarks using
**AWS Lambda@Edge**. Deployed as a CloudFront *origin request* function, it reads the
watermark token carried in the request path and rewrites the path to the rendition that
token names — the "mixer" role of a DoveRunner forensic watermarking deployment.

For more information, refer to the
[DoveRunner Forensic Watermarking Embedding Documentation](https://docs.doverunner.com/content-security/forensic-watermarking/embedding/)
and the
[Lambda@Edge Documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html).

## Requirements

- **Lambda runtime**: `nodejs24.x`
- **Node.js v24** locally, if you want to syntax-check the sources against the same engine
  version the runtime uses before uploading

> The `nodejs24.x` runtime does not support callback-style handlers. `export const handler`
> declares `(event)` only and returns the rewritten request — do not add a `callback`
> parameter when extending it, or the runtime rejects the function with
> `Runtime.CallbackHandlerDeprecated`.

> The sources are ES modules. Keep `package.json` in the deployment package — its
> `"type": "module"` is what makes the runtime load `index.js` as ESM.

## Configuration

Update `config.js` with your specific settings:

```javascript
export const config = {
    "aesKey": "YOUR_DOVERUNNER_SITE_KEY",
    "type": "unlabeled_a_variant",
    "availableInterval": 60,
    "prefixFolder": ["wm-contents"],
    "wmtPublicKey": "YOUR_PUBLIC_KEY",
    "wmtPassword": "YOUR_PASSWORD"
}
```

**wmt_type**: Indicates whether the issued token format is AES-encrypted or JWT. This corresponds to the specification provided when requesting the watermark token.
- [Watermark Token Request Specification](https://docs.doverunner.com/content-security/forensic-watermarking/embedding/session-manager/#api-data-json-format)

| Key                 | wmt_type | Description                                                                                                                                                                                                                                         |
|:--------------------|:---------|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `aesKey`            | aes      | The Site Key issued by the DoveRunner ContentSecurity Service.                                                                                                                                                                                      |
| `type`              | aes, jwt | The [Watermark File Folder Structure](#watermark-file-folder-structure). One of `unlabeled_a_variant`, `directory_prefix`, `aws`. Default: `unlabeled_a_variant`.                                                                                   |
| `availableInterval` | aes      | Token validity window in **minutes** (0 disables the check).                                                                                                                                                                                        |
| `prefixFolder`      | aes      | The top-level folder containing watermark files. Corresponds to `prefix_folder` in the [Watermark Token Request Specification](https://docs.doverunner.com/content-security/forensic-watermarking/embedding/session-manager/#api-data-json-format). |
| `wmtPublicKey`      | jwt      | PEM format public key for Akamai WMT.                                                                                                                                                                                                               |
| `wmtPassword`       | jwt      | Password for WMT token generation/verification.                                                                                                                                                                                                     |

> Lambda@Edge does not support environment variables, so every setting lives in
> `config.js` inside the deployment package. Changing a value means publishing a
> new function version.

## Watermark Forms and Token Payload

The DoveRunner AES watermark token carried in the request path decrypts to a JSON payload.
Its fields drive every rewrite decision the embedder makes:

| Field                  | Description                                                                                     |
|:-----------------------|:------------------------------------------------------------------------------------------------|
| `watermark_data`       | Base64 of the finished `0`/`1` symbol pattern.                                                  |
| `streaming_format`     | `dash` or `hls`. Informational — it no longer selects the first segment.                        |
| `first_segment_number` | Segment number the pattern is aligned to. Required — a token without it is rejected with `403`. |
| `timestamp`            | Issue time, `YYYY-MM-DDThh:mm:ssZ`, checked against `availableInterval`.                        |
| `revoke_flag`          | Whether a revoke token must accompany the request.                                              |
| `sync_skip_bit`        | Sync offset added to the segment number; `-1` when inactive. `0` is a valid, active offset.     |
| `renditions`           | Physical rendition count, `2` or `4`. Absent means `2`.                                         |
| `lead_in`              | Unmarked lead-in before the first marked segment, in symbols. Absent means `4`; `0` is valid.   |

The last two fields select the **watermark form**. A Long-Form token may omit them — the
defaults reproduce the Long-Form constants:

| Form       | `renditions` | `lead_in` |
|:-----------|-------------:|----------:|
| Long-Form  |            2 |         4 |
| Short-Form |            2 |         0 |
| Micro-Form |            4 |         0 |

**How symbols map to segments.** One symbol spans one media segment. One segment carries
`log2(renditions)` bits of the pattern: 1 bit with two renditions, 2 bits with four. The first
`lead_in` symbols play unmarked; after them the pattern repeats for the rest of the stream.

**How symbols name renditions.** Under `unlabeled_a_variant` the symbol becomes a file name
prefix; under `directory_prefix` and `aws` it becomes a path segment:

| Symbol | `unlabeled_a_variant` prefix       | `directory_prefix` / `aws` segment |
|:------:|:-----------------------------------|:-----------------------------------|
| `0`    | *(none — the unlabeled A variant)* | `/0`                               |
| `1`    | `b.`                               | `/1`                               |
| `2`    | `c.` — four renditions only        | `/2`                               |
| `3`    | `d.` — four renditions only        | `/3`                               |

Direct requests for a marked variant file are refused with `403` according to the rendition
count: two renditions block the `b.` prefix, four block `b.`, `c.` and `d.`.

The Akamai WMT route is different: that token carries only the symbol pattern, and the sample
resolves it with fixed Long-Form settings (`renditions` 2) and no lead-in.

## Watermark File Folder Structure

### unlabeled_a_variant

- A/B files exist in the same folder and are distinguished by filename prefixes.
- With two renditions the marked file is prefixed `b.`; with four renditions the
  prefixes are `b.`, `c.` and `d.`.

```text
/wm-contents/output_path/cid/dash/stream.mpd
/wm-contents/output_path/cid/dash/video/0/seg-125.m4s
/wm-contents/output_path/cid/dash/video/0/b.seg-125.m4s
/wm-contents/output_path/cid/hls/master.m3u8
/wm-contents/output_path/cid/hls/video/0/0/segment-125.ts
/wm-contents/output_path/cid/hls/video/0/0/b.segment-125.ts
```

### directory_prefix

- Distinguishes renditions by a `0`–`3` directory segment.

```text
/wm-contents/output_path/cid/{0/1}/dash/stream.mpd
/wm-contents/output_path/cid/{0/1}/dash/video/0/seg-125.m4s
/wm-contents/output_path/cid/{0/1}/hls/master.m3u8
/wm-contents/output_path/cid/{0/1}/hls/video/0/0/segment-125.ts
```

Per file type, the DoveRunner packager places content as follows
(`outputPath` is the `output_path` given at packaging time):

| Type          | Path                                                              |
|---------------|-------------------------------------------------------------------|
| mpd           | `outputPath/{0/1}/dash/stream.mpd`                                |
| m4s           | `outputPath/{0/1}/dash/{video/audio}/{codec}/{track}/seg-{i}.m4s` |
| init mp4      | `outputPath/{0/1}/{video/audio}/{codec}/{track}/init.mp4`         |
| master.m3u8   | `outputPath/{0/1}/hls/master.m3u8`                                |
| stream.m3u8   | `outputPath/{0/1}/hls/{video/audio}/{codec}/{track}/stream.m3u8`  |
| iframes.m3u8  | `outputPath/{0/1}/hls/video/{codec}/{track}/iframes.m3u8`         |
| subtitle.m3u8 | `outputPath/{0/1}/hls/subtitle/{lang}/subtitle.m3u8`              |
| ts            | `outputPath/{0/1}/hls/video/{codec}/{track}/segment-{i}.ts`       |
| aac           | `outputPath/{0/1}/hls/audio/{codec}/{lang}/segment-{i}.aac`       |
| vtt           | `outputPath/{0/1}/hls/subtitle/{lang}/{i}.vtt`                    |

### aws (AWS Elemental MediaConvert)

- For content packaged by MediaConvert. The `0`/`1` rendition directory sits directly
  above the streaming-format directory:

```text
s3://your-bucket/wm-contents/output_path/{0/1}/dash/stream.mpd
s3://your-bucket/wm-contents/output_path/{0/1}/hls/master.m3u8
```

MediaConvert output must satisfy:

1. Encode the content twice — once into the `0` (unmarked) destination and once into
   the `1` (marked) destination of the layout above.
2. Name the manifest `stream` for DASH and `master` for HLS.
3. Set **GOP size to 60**.
4. Segment settings: segment control `SEGMENTED_FILES`; DASH fragment/segment length
   `1`; HLS segment length `1`, minimum segment `0`, minimum final segment length `0`.

## Packaging Preconditions

The embedder picks a rendition from the **request path alone**. A path it cannot read is passed
through unmarked — playback still succeeds, but those segments carry no fingerprint and cannot be
traced. Your packager output must satisfy every rule below.

1. **End every media segment name with its segment number.** The number is taken after the last
   `_` or `-`, whichever comes later in the name, and everything following that separator must
   be digits. A name that adds a suffix after the number cannot be read and is served unmarked.
   Good `segment-125.ts`, `video_1080p-9.ts` · Bad `segment-125_backup.ts`

2. **End initialisation segment names with a lowercase `_init`, never with a number.** `_init` is
   the only spelling every `type` layout accepts. An init file whose name ends in a digit is read
   as a media segment instead, and whenever the symbol for that number is not `0` it is rewritten
   to a rendition path that does not exist and answers `404`.
   Good `video_init.mp4` · Bad `init-9.m4s`

3. **Keep the content path below the token deep enough.** Under `directory_prefix` the rendition
   directory is inserted 5 levels above `.ts`, `.m4s`, `.mp4`, `.aac`, `stream.m3u8` and
   `iframes.m3u8`, 4 levels above `subtitle.m3u8`, `.vtt` and any `.m4s`/`.mp4` directly inside a
   `subtitle` directory, and 2 levels above `.mpd` and any `.m3u8` whose name contains `master`;
   under `aws` it is always 2 levels. The path must hold at least that many parts,
   counting the file name — a shallower path receives no rendition directory at all.
   `unlabeled_a_variant` is unaffected, because it marks the file name rather than the path.
   Good `/{token}/out/cid/hls/video/avc1/1/segment-125.ts` · Bad `/{token}/cid/hls/segment-125.ts`

4. **Name HLS playlists as the layout expects.** Under `directory_prefix` an `.m3u8` name is
   recognised only when it contains `master`, or is exactly `stream.m3u8`, `iframes.m3u8` or
   `subtitle.m3u8`; the match is case-sensitive. Any other name falls back to a path that inserts
   `/0` above **every** `dash`, `hls` or `cmaf` directory in the path, and inserts nothing at all
   when the path contains none of those. `.mpd` manifests may carry any name.
   Good `master.m3u8`, `stream.m3u8` · Bad `index.m3u8`, `playlist.m3u8`

5. **Package to discrete segment files.** The rendition is chosen from the file name alone; no
   part of that decision looks at the `Range` header. An HLS `#EXT-X-BYTERANGE` layout — one file
   addressed by byte offsets — therefore presents a single name, and a single rendition, for the
   whole stream. Such a stream carries no usable fingerprint.
   Good `segment-1.ts`, `segment-2.ts`, … · Bad one `main.ts` plus `#EXT-X-BYTERANGE`

## Usage

The function intercepts requests at the CloudFront origin request event and routes them
based on the URL structure:

1. **Akamai WMT**: If the first path segment starts with `wmt:`, it uses `wmt/akamaiWmt.js`
   to verify the RS256 token signature and rewrite the path.
2. **DoveRunner AES**: If the first path segment matches one of the `prefixFolder`
   entries, it uses `wmt/doveRunnerAes.js` to decrypt the watermark token and rewrite
   the path to the rendition it names.
3. Any other request passes through unchanged.

Every rejected request — a malformed or expired token, or a direct request for a marked
variant file — is answered with `403` before it reaches the origin.

**Token lifetime on the Akamai WMT route.** The sample checks only the RS256 signature of a
`wmt:` token — it enforces no expiry, and `availableInterval` applies to the DoveRunner AES route
only. Bound the URL or token lifetime upstream, for example with Akamai edge token authorization
or short-lived signed URLs: if nothing upstream bounds it, a leaked `wmt:` URL stays valid until
the signing key is rotated.

## CDN caching

This function runs on the CloudFront **origin request** event, which fires only when CloudFront
forwards a request to the origin — on a cache miss, never on a cache hit. **Expiry is therefore
enforced at cache-miss granularity, not per request:** a response stored while the token was
inside `availableInterval` keeps being served from that edge until its TTL elapses, even after
the token has expired. A rendition stays reachable for `availableInterval` *plus* the cache TTL.

**The cache key contains the token.** By default it is the distribution domain name plus the URL
path of the *viewer* request — here `/{prefixFolder}/{token}/{content path}`. Distinct tokens are
distinct cache keys, so two viewers never share an entry: the cross-viewer hit ratio is
effectively zero and origin egress scales with the number of viewers. Rewriting `request.uri`
does not change this, because a URI changed on origin request does not affect the cache key. The
Cloudflare Workers sample differs — it keys on the rewritten variant path, so viewers that
resolve to the same rendition share one entry.

**Guidance**

- Cap the watermarked cache behaviour's max TTL at **`availableInterval` or less**
  (`availableInterval` is minutes, CloudFront TTLs are seconds).
- Keep the **default cache key** — no query strings, headers or cookies; they only multiply
  entries that are already per-viewer.
- To key on the rendition rather than the viewer, rewrite the URI in a CloudFront Function on the
  **viewer request** event, which runs before the cache lookup and does change the key.

## Deployment

### Step 1: Create the deployment package

The handler must sit at the zip root:

```bash
zip -r wmembedder-lambda.zip watermark-util wmt config.js index.js package.json LICENSE
```

The sample has no runtime dependencies, so no `node_modules` directory is packaged.

### Step 2: Create the Lambda function

- Region must be **US East (N. Virginia) `us-east-1`** — Lambda@Edge functions can only
  be created there; CloudFront replicates them to every edge location.
- Runtime `nodejs24.x`, handler `index.handler`.
- The execution role must allow both `lambda.amazonaws.com` and
  `edgelambda.amazonaws.com` to assume it
  ([Set up IAM permissions and roles for Lambda@Edge](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-edge-permissions.html)).

### Step 3: Publish and associate

1. Publish a **numbered version** of the function — Lambda@Edge does not accept
   `$LATEST` or aliases.
2. In your CloudFront distribution, edit the cache behavior that serves watermarked
   content and associate the function version with the **origin request** event.
3. Deploying a config change means repeating steps 1–2 with a new version.

### Verifying the sample locally

This repository carries the sample only. Its test suite lives in the DoveRunner monorepo the
sample is published from, where it runs against all three CDN samples on every change — so there
is no `npm test` here, and `npm install` has nothing to fetch: the sample has no dependencies.

What you can check before uploading is that the tree parses under the runtime's engine:

```bash
node --check index.js
node --check config.js
for file in watermark-util/*.js wmt/*.js; do node --check "$file"; done
```

Silence means every file is sound. Beyond that the function is only exercised meaningfully
through CloudFront: publish a numbered version, associate it with the origin request event as in
steps 1–3 above, and request a watermarked segment with a real token — the rewritten URI in the
CloudFront access log is the result to look at.

## Additional Resources

- [Lambda@Edge Documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html)
- [Restrictions on Lambda@Edge](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-edge-function-restrictions.html)
- [AWS Elemental MediaConvert Documentation](https://docs.aws.amazon.com/mediaconvert/latest/ug/what-is.html)
- [DoveRunner Forensic Watermarking Embedding Documentation](https://docs.doverunner.com/content-security/forensic-watermarking/embedding/)
