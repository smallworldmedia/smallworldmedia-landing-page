# SWM Media Naming Conventions

## File Naming Pattern

```
{client-abbr}-{group}-{seq}_{descriptive-name}.{ext}
```

### Components

| Segment         | Description                                                | Example       |
| --------------- | ---------------------------------------------------------- | ------------- |
| `client-abbr`   | 2–4 character abbreviation from the table below            | `hhs`         |
| `group`         | Sub-grouping within the project (e.g. `social`, `art`)     | `social`      |
| `seq`           | Zero-padded sequence number                                | `01`          |
| `descriptive`   | Readable name (kebab-case)                                 | `launch-post` |
| `ext`           | File extension                                             | `.jpg`        |

**Full example:** `hhs-social-01_launch-post.jpg`

---

## Client Abbreviation Table (51)

| Client                  | Abbreviation |
| ----------------------- | ------------ |
| Andhera Records         | `and`        |
| Annabel Englund         | `ann`        |
| Audiojack               | `adj`        |
| Bedouin                 | `bed`        |
| Bellaire                | `bel`        |
| Calussa                 | `cal`        |
| CID                     | `cid`        |
| Circus Music            | `cir`        |
| COCO Records            | `coco`       |
| DJ Tennis               | `djt`        |
| D'Witches               | `dwi`        |
| Easier Said             | `es`         |
| Facu Baez               | `fb`         |
| Fletch                  | `fle`        |
| Friends & Disco         | `fad`        |
| Front Left              | `fl`         |
| Heavy House Society     | `hhs`        |
| Helix Records           | `hel`        |
| Home//Grwxn.            | `hg`         |
| Hurry Up Slowly         | `hus`        |
| Jade Bern               | `jdb`        |
| Jamback                 | `jam`        |
| James Wyler             | `jw`         |
| Jeff Sorkowitz          | `js`         |
| Jonas Blue              | `jb`         |
| Kamino                  | `kam`        |
| Kyle Walker             | `kw`         |
| Ky William              | `kyw`        |
| LE YORA                 | `ly`         |
| Louder Than Silence     | `lts`        |
| Malóne                  | `mal`        |
| Maximo                  | `max`        |
| Momentum Records        | `mom`        |
| MOONLGHT                | `moon`       |
| Munchietown             | `mun`        |
| Mungo Sound Machine     | `msm`        |
| Nusonido                | `nus`        |
| Offstage                | `off`        |
| One Of Us               | `oou`        |
| Paige Tomlinson         | `pt`         |
| Panorama360             | `p360`       |
| Rossi.                  | `ros`        |
| Salomé Le Chat          | `slc`        |
| Sam Wolfe               | `sw`         |
| Short Circuit           | `sc`         |
| Sidney Charles          | `sid`        |
| Sosa                    | `sosa`       |
| Sunday Brunch           | `sb`         |
| TOBEHONEST              | `tbh`        |
| Ultra Records           | `ult`        |
| WIKKA                   | `wik`        |

---

## Folder Structure

```
Small World Media - Project Directory/
└── {client-slug}/                  # kebab-case of client name
    └── {project-slug}/             # kebab-case of project title
        ├── _manifest.md            # Metadata file for ingest script
        └── ...media files...
```

### Example

```
heavy-house-society/
├── hhs-branding-2024/
│   ├── _manifest.md
│   ├── hhs-brand-01_logo-primary.png
│   ├── hhs-brand-02_logo-mark.png
│   └── hhs-brand-03_color-palette.jpg
└── hhs-album-art/
    ├── _manifest.md
    ├── hhs-art-01_deep-dive-ep.jpg
    └── hhs-art-02_late-night.jpg
```

---

## Service Tags (14)

Use these exact names when tagging assets:

1. Branding
2. Live Visuals
3. Album Art
4. Event / Tour Creative
5. Illustration
6. Character Design
7. 2D Animation
8. 3D Animation
9. Logo Design
10. Web Design
11. Audio Reactive Media
12. Promo Video
13. VFX
14. Generative Media
