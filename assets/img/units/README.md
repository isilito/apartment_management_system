# Unit photos

## Add the real photos of a unit

1. Make a folder here named after the unit number, exactly as it is in the app: `201`, `J203`.
2. Save the photos in it. They show in file-name order, and the first one is the cover on the
   unit card, so naming them `1.jpg`, `2.jpg`, `3.jpg` … is easiest. Start with the living room.

```
assets/img/units/
  201/
    1.jpg      cover (living room)
    2.jpg      bedroom
    3.jpg      kitchen
    4.jpg      bathroom
  J203/
    1.jpg
```

Reload the page and the photos appear on the Units page, in the unit's drawer, on the dashboard's
"Empty units" card, and on the tenant's Home and My Unit pages.

- Landscape photos about 1600 px wide look best. Shrink phone photos first (4000 px files are slow).
- On XAMPP any `.jpg`, `.png` or `.webp` file works.
- On **Vercel** name them `1.jpg`, `2.jpg` … (lower-case `.jpg`, up to 8 per unit). Vercel cannot list
  folders, so the browser checks for those names.

## Building photos

Save them in `buildings/` named after the building id: `buildings/B1.jpg`, `buildings/B2.jpg`.

## Placeholders

A unit without its own folder shows the stand-in photos for its type from `placeholders/`
(`studio-*`, `1br-*`, `2br-*`, `bedspace-*`, each with a small `-sm` copy for the cards).
To change the picture for every unit of one type at once, replace those files and keep the names.

The placeholders are stand-in photographs from Wikimedia Commons, not Saraza's units. Their
photographers and licences are in `placeholders/CREDITS.md`, and Help & Guide credits them in the
app. Once every placeholder is replaced, you can delete the folder's photos and the credits section in `help.html`.
