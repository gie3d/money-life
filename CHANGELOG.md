# Release notes

Newest first. This file is shown in the app at `/releases` (the "Release notes" link in the footer), so keep the
`## [version] - date` headings as they are. When you ship a change, add a new version at the top and bump `version`
in `package.json` to match.

## [1.0.0] - 2026-11-08

### Goals
- **Year by year** on a goal now shows, for every year, the money put in, the growth from returns and the value at the
  end, each as plan, actual and difference. An **In total** row runs from the plan start to today and matches the
  "Ahead of plan" and "From returns" figures at the top.
- The current year is compared **to date**: plan and actual both stop at today, so the difference is fair. A plan that
  starts today now shows its first year instead of dashes.
- The plan-and-actual chart's hover box shows the **difference from plan** as an amount and a percentage (for the
  future, the projection against the plan).
- The goal form's chart continues past the retirement date and shows the money being spent down to age 95: planned
  monthly spending rising with inflation, savings still earning the plan's return. It adds a **Money at 95** figure, or
  the age the money runs out. Only for retirement goals planned by monthly spending.
- The goal page is wider on desktop so the year-by-year table fits without scrolling sideways, and the figures no longer
  overflow on a phone.

### Assets
- **Trades** and **Price history** (and the balance **History** of cash and savings assets) are paged, 7 to a page,
  newest first.
- One **From / To period** filter limits both lists, using the same calendar picker as Record trade. The picker starts
  empty ("Any date") and each end can be cleared. Trades and Price history sit side by side on a wide screen.
- Trade rows are laid out for the narrower column: the date stays on one line and the details sit under it.

### Update values
- A category with several investments (Gold, Bitcoin…) has one **price box on its category row**. What you type is copied
  into every investment under it, and each can still be changed by hand before saving.

### App
- The footer shows the version and a **Release notes** link to this page, with the latest changes and a way to open
  earlier versions.
- Docker publishes the web app on port **3333** and Postgres on **5333**, so it can run beside other projects.

## [0.3.0] - 2026-11-08

### Goals
- Goals for retirement or anything else: a target by amount, or by monthly spending with a withdrawal rate and inflation.
- A plan lists the assets that count, each with its own expected yearly growth and monthly amount; monthly amounts can
  rise a set percentage each year.
- Plan versions: revising keeps earlier plans, and any of them can be compared with what actually happened.
- A plan-and-actual chart with the target and a projection of carrying on as planned from today, and a breakdown of
  why you are ahead or behind: money put in against returns.

### App
- Upgraded Next.js to 16.4.5 (security fix).
- Deployment set-up for Umbrel.

## [0.2.0] - 2026-11-08

### Added
- Monthly bills.
- One page to update the values of all assets at once, with the effect on each category and the total shown before saving.
- Overview and Performance are separate pages, with new charts and a reworked dashboard.

### Changed
- Categories are managed under Settings.

## [0.1.0] - 2026-10-27

First version: asset management (cash, savings and investments with trades and prices), plans and user settings.
