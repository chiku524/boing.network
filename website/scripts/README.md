# Website scripts

## Animation config (site-wide 3D and mascot)

```bash
python generate_animation_config.py
```

Writes `src/styles/motion-config.css` (CSS variables for mascot float/glow, card tilt, link tilt) and `src/data/animations.json`. The theme and `BoingMascot` use these for consistent motion. Re-run after editing `CONFIG` in the script to tune values.

## Extracting robot and environment from `boing_robot_hero.png`

**Recommended for site theme:** run this first so the site uses the oceanic environment as background and the robot for mascot/hero.

```bash
pip install rembg  # optional; uses k-means fallback if not installed
python extract_robot_and_environment.py
```

- Writes `public/boing_robot_only.png` (robot on transparent) and `public/boing_environment.png` (coral, jellyfish, ocean — no robot). Uses rembg + OpenCV inpainting, or k-means if rembg is not installed.
- The site uses **boing_environment.png** as the background of all pages and **boing_robot_only.png** for the mascot and hero 3D animations.

## Extracting hero layers (k-means color layers)

```bash
pip install -r requirements.txt
python extract_hero_layers_simple.py
```

- Uses k-means in LAB space at reduced size for speed.
- Writes `public/hero_layer_0.png` … `public/hero_layer_5.png` (6 layers).
- The homepage hero stacks these and gives each layer its own 3D motion.

Requirements: `opencv-python-headless`, `numpy` (see `requirements.txt`).
