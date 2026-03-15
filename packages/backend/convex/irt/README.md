# IRT Calibration Pipeline

This module owns operational IRT scoring policy and durable item calibration for
 exercise sets.

## Current Operational Policy

- SNBT scoring uses `2PL`
- Ability estimation uses `EAP` over the operational 2PL item parameters
- New or weakly supported items remain `provisional` or `emerging`
- Official SNBT simulation attempts require a published tryout scale version
- Published scale versions freeze item parameters so official scores do not drift
  when future calibration runs update the live item bank
- Year-scoped global comparison is limited to the same locale and year, but does
  not currently perform additional cross-form linking beyond frozen calibrated
  scale versions

## Data Flow

```mermaid
flowchart TD
    A[completeSubject] --> B[enqueue set in irtCalibrationQueue]
    B --> C[cron drains calibration queue]
    C --> D[start calibration workflow]
    D --> E[load completed simulation set responses]
    E --> F[run set-level 2PL calibration]
    F --> G[persist exerciseItemParameters and irtCalibrationRuns]
    G --> H[enqueue affected tryouts for publication]
    H --> I[cron drains publication queue]
    I --> J{all tryout questions calibrated\nand snapshot changed?}
    J -- No --> K[skip publish]
    J -- Yes --> L[publish irtScaleVersion\nand irtScaleVersionItems]
    L --> M[new startTryout binds latest frozen scale]
```

## Modules

| File | Responsibility |
|------|----------------|
| `estimation.ts` | EAP theta estimation helpers |
| `scoring.ts` | Theta-to-score transforms |
| `policy.ts` | Centralized operational model and convergence policy |
| `calibration.ts` | Pure TypeScript 2PL calibration math |
| `internalQueries.ts` | Paginated response extraction for calibration |
| `internalActions.ts` | Set-level calibration job assembly and execution |
| `internalMutations.ts` | Run tracking and parameter persistence |
| `scaleVersions.ts` | Published tryout scale-version loading and snapshot helpers |
| `workflows.ts` | Durable orchestration for long-running calibration runs |

## Run Lifecycle

```mermaid
flowchart TD
    A[drainCalibrationQueue] --> B{enough new attempts\nor calibration is stale?}
    B -- No --> C[leave set queued]
    B -- Yes --> D[startCalibrationRun]
    D --> E[create running irtCalibrationRuns row]
    E --> F[start durable workflow]
    F --> G[calibrateSetTwoPL action]
    G --> H{action succeeded?}
    H -- Yes --> I[completeCalibrationRun]
    I --> J[persist params and queue tryouts]
    H -- No --> K[failCalibrationRun]
    K --> L[mark failed and requeue set]
```

## Notes

- Calibration currently works at the `exerciseSet` level
- Calibration input is limited to `completed` `simulation` set attempts
- This pipeline improves item parameters and freezes official scales, but it does
  not attempt additional cross-form equating/linking for unique-item tryouts
