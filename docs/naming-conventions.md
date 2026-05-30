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

> See [CONTEXT.md](../CONTEXT.md) for the full domain glossary.

```
media/                                  # gitignored (except _manifest.md files)
└── {Client Name}/                      # Display name, not kebab-case
    ├── _manifest.md                    # Root manifest (Mode 2 — per-row serviceType)
    ├── ...root media files...          # Flat — no organizational subfolders
    ├── Artwork/                        # Artwork Catalog (canonical name)
    │   ├── _manifest.md               # Mode 1 — services: album art
    │   └── ...album art JPEGs...
    └── {Featured Project}/             # Featured Project (any other subfolder)
        ├── _manifest.md               # Mode 1 — project-specific services
        └── ...project media files...
```

### Rules
- **Root level is flat.** All files at the client root belong to the root manifest.
- **Subfolders = Curated Collections.** A subfolder named `Artwork` is an Artwork Catalog. Any other subfolder is a Featured Project.
- **No nesting beyond one level.** Curated Collections do not contain sub-subfolders.

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
