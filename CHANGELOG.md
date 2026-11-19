# Release notes

Newest first. This file is shown in the app at `/releases` (the "Release notes" link in the footer), so keep the
`## [version] - date` headings as they are. When you ship a change, add a new version at the top and bump `version`
in `package.json` to match. Under each `###` section, add an `*Open:*` line linking to the page it changed.

## [1.8.0] - 2026-11-19

### Tax
*Open:* [Future → Tax](/tax)
- New **Tax** page under Future: work out your Thai personal income tax for a year. Plans are grouped by tax year,
  and you can keep as many as you like for the same year to compare (the lowest is marked). **Duplicate** copies a
  plan with everything in it, to try something different.
- Each plan has three steps. **1 Income**: what you earned, by type under Section 40 (salary, freelance fees,
  royalties, interest and dividends, rent, liberal professions, contract work, business), with the tax withheld on
  each. **2 Expenses and deductions**: expenses are worked out for you by type (50% up to 100,000 for salary and fees,
  the standard rates for rent, professions and business, or your actual expenses), and you type each deduction as
  paid: family, insurance, social security, PVD, RMF, pension insurance, Thai ESG, home loan interest, Easy e-Receipt
  and donations. **3 How the tax is worked out**: every deduction with its limit applied (including the 500,000 cap
  on retirement savings together), net income, the tax in each bracket, the 0.5% minimum tax where it applies, and
  what is left to pay or comes back.
- The Tax pages are in Thai: labels, steps, the rates panel, notes, dialogs and error messages. Tax years show in
  พ.ศ. (with ค.ศ. beside them).
- The plan page works out the tax **as you type**: change an income amount, the tax withheld, or any deduction and
  every figure updates at once. Changes save on their own a moment after you stop typing ("All changes saved").
- **Your tax** panel stays in view (beside the steps on a wide screen; at the bottom of a phone screen, tap Rates to
  open it): income, expenses, deductions, net income, then the progressive rates with a bar showing how full each
  bracket is and the top one marked, the tax due, and what is left to pay or comes back. It shows how much the tax
  has changed since you opened the page and what each 1,000 more of deductions saves. Under the bracket you are in,
  it says how much more you can deduct at that rate, the tax that would save, and the bracket you would drop to.
- Step 2 has tabs: ค่าใช้จ่าย, ครอบครัว, ประกัน, เงินออมและการลงทุน, ที่อยู่อาศัยและกระตุ้นเศรษฐกิจ and เงินบริจาค, each showing
  what it takes off. A field whose limit cuts what you typed shows what is actually deducted.
- Amount fields on the Tax pages take a **sum**: type `15000*6` (or `x`, `×`, `+`, `-`, `/`, brackets) and a moment
  after you stop typing it becomes 90,000 and the tax updates. Leaving the field or pressing Enter works it out at once;
  a sum that doesn't work out gets a red border.
- The limits follow the tax year: social security up to 9,000 to 2025 and 10,500 from 2026, Easy e-Receipt 50,000 in
  2024 and 2025 (none announced for 2026), SSF only to 2024, Thai ESG 300,000 to 2026.

## [1.7.0] - 2026-11-18

### Home
*Open:* [Home](/)
- "Where it's heading" splits the trend into the money you put in and what your investments earned on their own.
  The money you put in carries on at its monthly average, and your investments keep growing at their recent rate,
  compounding. A large one-off deposit no longer reads as growth. The line under the title now says how much you
  have been putting in a month and how fast your investments have grown in a year.
- A shaded **likely range** around the line, from how much your investments have swung month to month over the
  last 12 months: about two times in three the value should land inside it. It widens the further ahead it looks,
  with more room above than below, and the figure for the end date shows it too. It needs at least 3 months of
  investment history; the money you put in is taken as certain.
- New **Your safety net** card. How long it would last: how many months the assets you can turn into cash within days would cover
  your essentials (Must and Need spending, categories not sorted yet, and your bills) if nothing came in, and how
  long at your usual spending. Spending is averaged over the last 6 whole months you recorded. Under 3 months shows
  in red. Under it, your **savings rate**: what you kept of your income over the last 6 whole months you recorded
  it, after everyday spending, hobbies and bills.
- With a goal set, a **Recent trend / As your goals plan** switch. As your goals plan carries each asset in a goal on
  at the growth and monthly amount its plan sets, from what it is worth today (the monthly amount rises as the plan
  says and stops at the goal's date); assets in no goal stay on their trend. The switch is kept in the address with the span.
- A **Total / By category** switch on the chart: By category stacks one layer per asset category, each on its own
  trend, adding up to the total.

### Install (Umbrel)
- **Automatic backups**: a new `backup` service writes a full copy of the database to `data/backups` when it starts and
  then once a day, keeping the last 14 days (`BACKUP_EVERY_HOURS` and `BACKUP_KEEP_DAYS` in `.env`). `./restore.sh`
  puts the database back to one (saving a copy of the current one first), and `make backup-pull` copies the backups
  to the computer you deploy from. See README.txt.

### Assets
*Open:* [Assets](/accounts) · [Settings → Categories](/settings/categories)
- Give each asset category a **target**: the share of your total value you aim to keep in it, set beside the category
  under Settings → Categories (which also shows what the targets add up to). On Assets, the Allocation chart marks
  each target on its bar and says how far off it is: on target (within 2 points), or so many points over or under,
  with the amount to add or take out to land on it. A category with a target but nothing in it yet still shows.
  On a phone, the Categories list leaves out each category's type to make room.

### Spending
*Open:* [Spending → Everyday](/spending)
- Type the month's **income** at the top of the month's form on Everyday spending (Fill empty from last month fills it
  too). A new **Saved** tile shows what you kept that month, after everyday spending, hobbies bought that month and
  your bills at their monthly cost, and what share of the income that is.

## [1.6.0] - 2026-11-15

### Plans
*Open:* [Future → Plans](/plans) · [All plans](/plans/all)
- The Plans page has two tabs: **Expense** (a car, a trip: the plans you pay for, as before) and **Income** (a salary,
  a bonus, a new job). An income plan holds money coming in: one-time (a bonus on a date) or recurring (every month or
  every year, for the number of payments you set). Its page shows what is still to come, and each tab has its own
  "Start a plan" form. "All plans" lists both, with a Type column.
- A plan that held both costs and income is split: the income moves to a new "<name> income" plan.

### Home
*Open:* [Home](/)
- "Where it's heading" counts plan income: it is added to the dotted line as it falls due, next to the plan costs
  taken off it. The line is now called **After plans**, and "More detail" lists the costs and the income together.

## [1.5.1] - 2026-11-15

### Home
*Open:* [Home](/)
- "Where it's heading" has a switch for how far it looks back and ahead: ±3 months, ±6 months, ±1 year (as before)
  ±3 years or ±5 years.

## [1.5.0] - 2026-11-15

### Assets
*Open:* [Assets](/accounts)
- Drag an asset up or down within its category on the Assets page to put them in your own order. The order is saved
  when you drop it, and a new asset goes to the end of its category.

## [1.4.0] - 2026-11-12

### Spending
*Open:* [Spending → Everyday](/spending) · [Hobbies](/spending/hobbies)
- A **Today** button beside the month on Everyday spending, and beside the year on Hobbies, jumps back to the
  current one.
- Hover (or touch) a bar in the Month by month and Year by year charts to read its total and what each category,
  hobby or tier came to.
- Each category has a small remark box on the month's form, for what's worth remembering (e.g. "trip to Chiang
  Mai"). The remark shows under the category in "Where it went".
- Mark each everyday category as a **Must**, a **Need** or a **Want** (under Categories). The starter set comes
  sorted; your existing categories start as "Not sorted" until you choose.
- The Everyday page now shows the month split into Must, Need and Want, as one bar of 100% under "Where it went"
  with each share's change against last month. One "Group by" switch above the Month by month chart sets both the chart and the
  month-by-month table to categories or Must, Need, Want. Each category in the table carries its tier. Hover (or touch) a small trend chart in the table to read the month and
  amount under it.

### Goals
*Open:* [Home](/) · [Future → Goals](/goals) (open a goal for its plan table)
- The goal chart on Home is drawn like the one on the goal page: actual in green above zero and red below, the plan
  dashed, carrying on as planned dotted, and the target line once the chart reaches it. Its legend now says Plan
  where it said Target.
- The plan table on a goal is rebuilt with one row per asset, grouped under its category (a row for the category adds its assets up, and a click on it opens or folds its assets, folded to start): its expected growth a year, the amount to put in a
  month, what that makes in a year (expected) against what actually went in over the last 12 months, and then a column
  per year with the value the plan expected at its end, the actual value and the difference as a percentage. It
  shows the latest 3 years, with Earlier / Later to page through the rest or "Show all years", and the asset names
  stay in view while you scroll. An asset the plan gave no start value or monthly amount is expected from its first
  record on, at its own growth rate, and the total adds every row. That expectation is part of the plan itself, so the chart, the
  goal's status on Home and the Goals list count those assets the same way.

### Assets
*Open:* [Assets](/accounts)
- Hover (or touch) the small chart on an asset or group to read the date and value under the pointer: the balance
  and its change for cash and savings, the change since the start for investments.
- Cash and savings no longer show a return percentage: a balance rises and falls with what you spend and deposit,
  so it reads as an amount only. Their small chart is the balance itself, and a group starts on the first day every
  account in it has a record, so accounts you added later don't read as the balance jumping from nothing.
- Fixed an asset's 6-month return reading far too low (e.g. -104%) when it was funded by a transfer or first
  purchase only days ago. Records from before it held anything no longer count as a starting balance of zero.
- The small chart beside an asset now sets money moved in or out aside, so moving BTC to another wallet no longer
  looks like a drop. The date it starts from and its value then are written inside it, at its left end, and the percentage and the amount beside it are the
  change since that date (the last 6 months, or the day a newer asset first held anything). That amount replaces the
  value-against-cost one on each row; the investments total still uses cost.

## [1.3.0] - 2026-11-12

### Spending
*Open:* [Spending → Everyday](/spending) · [Hobbies](/spending/hobbies)
- A new **Spending** tab, between Assets and Future, with two pages:
  - **Everyday**: once a month, type what each category came to (from your other app or bank statement), with last
    month's amount beside each box and a button to fill empty ones from it. See the month's total against last month
    and the average of the months before, where it went, the last 12 months by category, and a table of each
    category over the last 6 months, with a small chart of its last 12 months on each row to show the trend.
  - **Hobbies**: trips, gadgets and the things you love, year by year. See this year against last year (and the
    same part of last year), the average of the years before, a chart of every year by hobby, and a table of each
    hobby year by year. Each thing can have a note on how it felt to spend on it, shown under it in the list.
- Everyday categories are your own list: start from a suggested set or from nothing, then add, rename, reorder or
  remove them. A removed category keeps its past months and can be put back.
- Hobbies are free text: type any name, or tap one you've used.

### Journal
*Open:* [Journal](/journal)
- An entry now shows what its money was worth then next to what it is worth now, with the change. Below the text,
  a card shows how it was split between categories that day; open a category to see each asset, then and now.
- Ticking every asset now means "everything", so an asset you add later counts too, and the entry no longer lists
  every name.

## [1.2.0] - 2026-11-11

### Journal
*Open:* [Journal](/journal) · [New entry](/journal/new)
- A new **Journal** tab, next to Future (on a phone, a round button at the bottom right replaces the bottom bar and opens a menu of everything): write down how a period of life feels, in Markdown with a preview, with a date,
  a title and an optional mood. Each entry shows what everything you had was worth on its date, so you can look back
  and remember both.

### Home
*Open:* [Home](/)
- Each goal on Home now has a small chart: the last 6 months and the next 3 years, with your actual value, the plan
  and where carrying on as planned leads. Hover it for the values and how far you are from the plan.

## [1.1.0] - 2026-11-11

### Easier to find your way
- Three sections instead of six tabs: **Home**, **Assets** (with Performance) and **Future** (Goals, Plans and Bills).
  Each section shows its pages as tabs at the top, with a line on what each one is for.
- On a phone the sections sit in a **bottom bar**, with Settings beside them; the hamburger menu is gone. Sign out is
  in Settings.

### Record
*Open:* [Record](/record)
- One **Record** button (the + in the middle of the bottom bar, top right on a computer) asks "What happened?":
  balances and prices checked, a buy, a sale, money in or out, or units moved between investments. It asks for the
  asset, then shows only the fields for that choice.
- Forms say **Saved** when they've saved, with links to the asset, to record something else, or Home.

### Home
*Open:* [Home](/)
- Home answers three questions: what you have (with the change over the last month), where it's heading (one figure
  for a year from now, the stats under **More detail**) and whether your goals are on track (one line each).
- How each figure is worked out is behind a small **i** button instead of paragraphs on the page.
- When assets are due a new value, Home says which ones and how long ago each was updated, with **Update now**. When
  an asset is due depends on its liquidity: after 45 days for Immediately and Days, 3 months for Months, and a little
  over a year for Years and Retirement (a house or a pension is usually valued once a year). **Later** hides the
  reminder for a week on that device.
- Allocation moved to the Assets page, and profit or loss now shows on each investment there.

### Simpler pages
*Open:* [Assets](/accounts) (open an investment) · [Future → Goals](/goals) (open a goal)
- An investment's page leads with what it's worth, the profit or loss and the units held. The price, average price
  paid, total paid and profit from sales are under **More details**.
- A goal's **Year by year** table is folded away, with the total difference on its heading.

### Getting started
*Open:* [Setup](/welcome)
- New users get a short **setup**: pick the currency, tick the kinds of assets you have, enter what each is worth today,
  then optionally set a goal. It is at `/welcome`, and Home links to it while nothing is recorded.

## [1.0.0] - 2026-11-08

### Goals
*Open:* [Future → Goals](/goals) (open a goal) · [New goal](/goals/new)
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
*Open:* [Assets](/accounts) (open an asset)
- **Trades** and **Price history** (and the balance **History** of cash and savings assets) are paged, 7 to a page,
  newest first.
- One **From / To period** filter limits both lists, using the same calendar picker as Record trade. The picker starts
  empty ("Any date") and each end can be cleared. Trades and Price history sit side by side on a wide screen.
- Trade rows are laid out for the narrower column: the date stays on one line and the details sit under it.

### Update values
*Open:* [Update values](/update)
- A category with several investments (Gold, Bitcoin…) has one **price box on its category row**. What you type is copied
  into every investment under it, and each can still be changed by hand before saving.

### App
*Open:* [Release notes](/releases)
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
*Open:* [Future → Goals](/goals)
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
