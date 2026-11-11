# Release notes

Newest first. This file is shown in the app at `/releases` (the "Release notes" link in the footer), so keep the
`## [version] - date` headings as they are. When you ship a change, add a new version at the top and bump `version`
in `package.json` to match.

## [1.2.0] - 2026-11-11

### Journal
- A new **Journal** tab, next to Future (on a phone, a small round button at the bottom right opens its menu): write down how a period of life feels, in Markdown with a preview, with a date,
  a title and an optional mood. Each entry shows what everything you had was worth on its date, so you can look back
  and remember both.

### Home
- Each goal on Home now has a small chart: the last 6 months and the next 3 years, with your actual value, the plan
  and where carrying on as planned leads. Hover it for the values and how far you are from the plan.

## [1.1.0] - 2026-11-11

### Easier to find your way
- Three sections instead of six tabs: **Home**, **Assets** (with Performance) and **Future** (Goals, Plans and Bills).
  Each section shows its pages as tabs at the top, with a line on what each one is for.
- On a phone the sections sit in a **bottom bar**, with Settings beside them; the hamburger menu is gone. Sign out is
  in Settings.

### Record
- One **Record** button (the + in the middle of the bottom bar, top right on a computer) asks "What happened?":
  balances and prices checked, a buy, a sale, money in or out, or units moved between investments. It asks for the
  asset, then shows only the fields for that choice.
- Forms say **Saved** when they've saved, with links to the asset, to record something else, or Home.

### Home
- Home answers three questions: what you have (with the change over the last month), where it's heading (one figure
  for a year from now, the stats under **More detail**) and whether your goals are on track (one line each).
- How each figure is worked out is behind a small **i** button instead of paragraphs on the page.
- When assets are due a new value, Home says which ones and how long ago each was updated, with **Update now**. When
  an asset is due depends on its liquidity: after 45 days for Immediately and Days, 3 months for Months, and a little
  over a year for Years and Retirement (a house or a pension is usually valued once a year). **Later** hides the
  reminder for a week on that device.
- Allocation moved to the Assets page, and profit or loss now shows on each investment there.

### Simpler pages
- An investment's page leads with what it's worth, the profit or loss and the units held. The price, average price
  paid, total paid and profit from sales are under **More details**.
- A goal's **Year by year** table is folded away, with the total difference on its heading.

### Getting started
- New users get a short **setup**: pick the currency, tick the kinds of assets you have, enter what each is worth today,
  then optionally set a goal. It is at `/welcome`, and Home links to it while nothing is recorded.

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
- A **reload button** in the top bar, before the theme switch, for using the app as an installed web app.
- When a newer version has been deployed, a bar at the bottom asks you to **reload**. The open app checks every minute
  and whenever it comes back to the foreground.
- On a narrow screen the top menu moves into a **hamburger menu** (pages, Settings and Sign out); reload and the theme
  switch stay in the bar.
- The app has its own **icon** (the sprout) for "Add to Home Screen" on iPhone and Android, and opens full screen under
  the name Money Life.
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
