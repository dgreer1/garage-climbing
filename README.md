# garage-climbing
A website for our garage climbing wall, with all the climbing challenges, routes and problems to try.

## Open the Site

- Local development: <http://localhost:8000/index.html>
- Deployed GitHub Pages site: <https://dgreer1.github.io/garage-climbing/>

Start the local server from the project root with:

```bash
python -m http.server 8000
```

## Working with a New Wall Image

The site stores hold positions as normalized coordinates on the canonical wall image, `georef_image.jpg`. If you replace that image with a new photograph, do not move the holds by eye. Register the new photograph with control points (CPs), calculate a transform, and then use the transformed hold coordinates with the new image.

### 1. Start the admin tool

Run the site through a local HTTP server. Opening `admin.html` directly from the file system prevents module scripts and JSON files from loading.

```bash
python -m http.server 8000
```

Open <http://localhost:8000/admin.html>.

### 2. Confirm the canonical control points

Choose **Register CPs** and load the current reference image with **Use repo reference image**. The orange CP markers are the known points in canonical normalized coordinates.

Use **Move** only if a canonical CP itself was recorded incorrectly. Moving a CP changes the reference geometry used by every future registration. Download `control-points.json` and commit it to `data/control-points.json` when the canonical points are correct.

### 3. Load and register the new photograph

1. Click **Load image** and select the replacement wall photograph.
2. For each canonical CP, click **Set on image** beside that CP.
3. Click the matching physical point on the newly loaded photograph.
4. Repeat for at least four CPs. Use well-spread points around the wall, preferably near the corners or edges, rather than four points in one small area.

**Move** changes the canonical CP. **Set on image** records where that same CP appears in the currently loaded photograph. The second operation is what supplies the correspondence used for the image transform.

Click **Download control-points.json** after matching points. It now includes the original `controlPoints` plus an `imageControlPoints` array containing each matched CP's canonical and new-image coordinates. **Download image CPs** produces the smaller registration-only export as `image-control-points.json`. These exports are useful for checking whether the new-image points were recorded correctly before calculating a layout.

### 4. Save the registration

Enter a layout id, such as `wall-2026-09`, and click **Save layout for this image**. The admin tool calculates a projective transform (homography) from the canonical CPs to the new image and downloads `layouts-<id>.json`.

Keep the layout file as a record of the registration. Combine it with other saved layouts in `layouts.json` if you want to keep a history of image registrations.

### 5. Transform the holds

With the same layout id entered, click **Apply layout to holds**. This downloads `holds-updated.json` containing the hold coordinates transformed for the new image.

Review the result in the admin tool before replacing the committed data. If the positions look correct:

1. Replace `data/holds.json` with the downloaded `holds-updated.json` and keep the filename `holds.json`.
2. Replace `georef_image.jpg` with the new wall image.
3. Commit the updated `georef_image.jpg`, `data/holds.json`, and the relevant layout record in `data/layouts.json`.

The climb definitions in `data/climbs.json` continue to work because climbs refer to persistent hold IDs, not pixel coordinates. Do not create new hold IDs merely because the wall photograph changed.

### 6. Verify before publishing

Switch between **Register CPs** and **Holds** in the admin tool. CP markers appear in CP mode and hold markers appear in Holds mode. Check the transformed hold positions over the new image, then open the public site and verify the thumbnails and modal overlays.

If the result is distorted, use more widely distributed CPs, check that every CP was matched to the correct physical point, and repeat the registration. Keep the original image and `data/holds.json` until the new registration has been checked.

## Data Files

- `georef_image.jpg`: canonical wall image used by the public overlays.
- `data/control-points.json`: canonical CP coordinates.
- `data/holds.json`: persistent hold IDs and normalized coordinates.
- `data/climbs.json`: climbs and their ordered hold IDs, plus grades and notes.
- `data/layouts.json`: optional saved image registrations and transforms.
