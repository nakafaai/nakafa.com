# IRT Calibration Pipeline

This module owns operational IRT scoring policy and durable item calibration for
 exercise sets.

## Current Operational Policy

- SNBT scoring uses `2PL` operationally
- Stored item parameters keep `guessing`, but operational scoring sets `c = 0`
- Ability estimation uses `EAP` over the operational 2PL item parameters
- New or weakly supported items remain `provisional` or `emerging`

## Data Flow

```text
completed simulation answers
    |
    v
exerciseAnswers(questionId, isCorrect, attempt metadata)
    |
    v
irt/internalQueries.ts
    |
    v
irt/internalActions.ts
    |
    +--> load completed simulation responses in pages
    +--> run alternating 2PL calibration
    |
    v
irt/workflows.ts
    |
    v
irt/internalMutations.ts
    |
    +--> persist exerciseItemParameters
    +--> persist irtCalibrationRuns audit record
```

## Modules

| File | Responsibility |
|------|----------------|
| `estimation.ts` | EAP theta estimation and operational 2PL normalization |
| `scoring.ts` | Theta-to-score transforms |
| `policy.ts` | Centralized operational model and convergence policy |
| `calibration.ts` | Pure TypeScript 2PL calibration math |
| `internalQueries.ts` | Paginated response extraction for calibration |
| `internalActions.ts` | Set-level calibration job assembly and execution |
| `internalMutations.ts` | Run tracking and parameter persistence |
| `workflows.ts` | Durable orchestration for long-running calibration runs |

## Run Lifecycle

```text
startCalibrationRun(setId)
    |
    +--> create irtCalibrationRuns row (running)
    +--> start durable workflow
            |
            +--> calibrateSetTwoPL action
            +--> completeCalibrationRun mutation
            +--> or failCalibrationRun mutation
```

## Notes

- Calibration currently works at the `exerciseSet` level
- Calibration input is limited to `completed` `simulation` attempts
- This pipeline improves item parameters, but it is not yet a full cross-form
  equating/linking system
