# Kestrel DAX measure starters (Release 1 semantic model)

All Kestrel data is synthetic. These measures use the exact table and column names in `source-to-target.csv`. Load the cleaned tables first (the rules are in `quality-and-reconciliation.md`), then create the measures in a measure table.

## Model this code expects

Star schema with single-direction, one-to-many relationships:

- DimDate[Date] to FactEDVisit[ArrivalDate]
- DimDate[Date] to FactBedCensus[CensusDate]
- DimDate[Date] to FactServiceTicket[OpenedDate]
- DimSite[SiteCode] to FactEDVisit[SiteCode]
- DimSite[SiteCode] to FactServiceTicket[SiteCode]
- DimSite[SiteCode] to DimUnit[SiteCode], then DimUnit[UnitID] to FactBedCensus[UnitID] (a site filter reaches the census through DimUnit)
- DimCTAS[CTASLevel] to FactEDVisit[CTASLevel]

Mark DimDate as the date table. MinutesToPIA and EDLOSMinutes are whole-number columns built in Power Query; they are null when the source timestamps are missing or out of order, so every measure below ignores those rows on purpose.

## Measures

```DAX
ED Visits =
COUNTROWS ( FactEDVisit )

Median Minutes to PIA =
MEDIANX (
    FILTER ( FactEDVisit, NOT ISBLANK ( FactEDVisit[MinutesToPIA] ) ),
    FactEDVisit[MinutesToPIA]
)

% PIA Within CTAS Target =
DIVIDE (
    COUNTROWS (
        FILTER (
            FactEDVisit,
            NOT ISBLANK ( FactEDVisit[MinutesToPIA] )
                && FactEDVisit[MinutesToPIA] <= RELATED ( DimCTAS[TargetMinutes] )
        )
    ),
    COUNTROWS (
        FILTER ( FactEDVisit, NOT ISBLANK ( FactEDVisit[MinutesToPIA] ) )
    )
)

LWBS Rate =
DIVIDE (
    CALCULATE ( [ED Visits], FactEDVisit[Disposition] = "LWBS" ),
    [ED Visits]
)

Median ED LOS Hours =
DIVIDE (
    MEDIANX (
        FILTER ( FactEDVisit, NOT ISBLANK ( FactEDVisit[EDLOSMinutes] ) ),
        FactEDVisit[EDLOSMinutes]
    ),
    60
)

Median ED LOS Hours Admitted =
CALCULATE ( [Median ED LOS Hours], FactEDVisit[Disposition] = "Admitted" )

Median ED LOS Hours Discharged =
CALCULATE ( [Median ED LOS Hours], FactEDVisit[Disposition] = "Discharged" )

Occupancy % (Average Daily) =
AVERAGEX (
    FILTER (
        VALUES ( DimDate[Date] ),
        CALCULATE ( SUM ( FactBedCensus[StaffedBeds] ) ) > 0
    ),
    DIVIDE (
        CALCULATE ( SUM ( FactBedCensus[OccupiedBeds] ) ),
        CALCULATE ( SUM ( FactBedCensus[StaffedBeds] ) )
    )
)

Occupancy % (Last Snapshot) =
VAR LastCensusDate =
    MAX ( FactBedCensus[CensusDate] )
RETURN
    CALCULATE (
        DIVIDE ( SUM ( FactBedCensus[OccupiedBeds] ), SUM ( FactBedCensus[StaffedBeds] ) ),
        DimDate[Date] = LastCensusDate
    )

ALC Days =
SUM ( FactBedCensus[ALCPatients] )

Tickets =
COUNTROWS ( FactServiceTicket )

SLA Met % =
DIVIDE (
    CALCULATE ( [Tickets], FactServiceTicket[SLAMet] = "Y" ),
    CALCULATE ( [Tickets], FactServiceTicket[SLAMet] IN { "Y", "N" } )
)

Median Access Request Days =
DIVIDE (
    CALCULATE (
        MEDIANX (
            FILTER ( FactServiceTicket, NOT ISBLANK ( FactServiceTicket[ResolutionHours] ) ),
            FactServiceTicket[ResolutionHours]
        ),
        FactServiceTicket[TicketType] = "Access request"
    ),
    24
)
```

## Why each measure is written this way

- **ED Visits** counts rows in the cleaned fact table, so duplicates and quarantined rows are already gone.
- **Median Minutes to PIA** uses MEDIANX over the visits that have a valid MinutesToPIA. LWBS visits have no PIA and drop out. Kestrel measures from arrival because registration happens at arrival; some organizations measure from triage, so always say which clock you used.
- **% PIA Within CTAS Target** compares each visit with the target of its own CTAS level through RELATED, which works because FILTER iterates FactEDVisit rows on the many side of the DimCTAS relationship. CTAS 1 has a target of 0 minutes, so only a PIA in the same minute as arrival counts. The denominator is visits with a valid PIA (Kestrel rule); an LWBS visit is not counted as a miss.
- **LWBS Rate** divides LWBS visits by all valid visits in the current filter.
- **Median ED LOS Hours** takes the median in minutes and divides by 60. Use the Admitted and Discharged versions side by side: admitted patients wait for a bed, so their stay is far longer.
- **Occupancy % (Average Daily)** is semi-additive. Beds add up across units on the same day, but not across days: 30 days of 32 staffed beds is not 960 beds. The measure works out occupancy for each day (occupied divided by staffed, summed across the units in the filter) and then averages those daily ratios. The FILTER skips dates with no census rows, such as calendar days after 30 September.
- **Occupancy % (Last Snapshot)** answers "how full were we at the end of the period?" It finds the latest census date in the current filter and calculates occupancy for that date only. Use it on cards and for "as at" reporting. Use the average version for trends and period comparisons.
- **ALC Days** is a plain SUM, and that is correct: one ALC patient in a bed for one day is one ALC patient-day, so adding daily counts gives patient-days, not patients.
- **SLA Met %** divides tickets with SLAMet = "Y" by tickets with a known outcome (Y or N). Tickets still inside their target, tickets with no priority and tickets with impossible times are left out of both parts.
- **Median Access Request Days** keeps only access requests and resolved tickets with valid times, takes the median of ResolutionHours, and divides by 24.

## Expected results with no filters

Check your model against these figures from `truth.json`. Power BI shows more decimals; round before comparing.

| Measure | Expected |
|---|---|
| ED Visits | 474 |
| Median Minutes to PIA | 64.0 |
| % PIA Within CTAS Target | 28.3% |
| LWBS Rate | 5.7% |
| Median ED LOS Hours | 3.82 |
| Median ED LOS Hours Admitted | 11.96 |
| Median ED LOS Hours Discharged | 3.61 |
| Occupancy % (Average Daily) | 87.0% |
| Occupancy % (Last Snapshot) | 84.0% |
| ALC Days | 2,075 |
| Tickets | 219 |
| SLA Met % | 64.6% |
| Median Access Request Days | 4.26 |

## Expected results by site

| Site | ED Visits | Median Minutes to PIA | % PIA Within CTAS Target | LWBS Rate | Median ED LOS Hours Admitted | Occupancy % (Average Daily) | Occupancy % (Last Snapshot) |
|---|---|---|---|---|---|---|---|
| KGH | 213 | 80.5 | 12.8% | 7.5% | 15.14 | 89.3% | 84.7% |
| ARH | 105 | 54.5 | 34.0% | 4.8% | 9.45 | 84.8% | 82.5% |
| CVH | 101 | 54.0 | 39.2% | 4.0% | 8.58 | 87.9% | 86.4% |
| PGH | 55 | 45.5 | 55.8% | 3.6% | 8.33 | 76.8% | 80.0% |

## Expected % PIA Within CTAS Target by CTAS level

| CTAS level | Target minutes | Visits with a valid PIA | Within target | % PIA Within CTAS Target | Median Minutes to PIA |
|---|---|---|---|---|---|
| 1 | 0 | 7 | 3 | 42.9% | 1.0 |
| 2 | 15 | 45 | 15 | 33.3% | 27.0 |
| 3 | 30 | 186 | 29 | 15.6% | 55.0 |
| 4 | 60 | 151 | 46 | 30.5% | 76.0 |
| 5 | 120 | 56 | 33 | 58.9% | 100.0 |

For every measure, record the business definition, owner, format, how blanks behave, the expected result and your reconciliation evidence.
