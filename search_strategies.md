# Search Strategies

This document stores the search strategies used for the HRQoL after cardiac arrest review, grouped by database and query set.

**Query intent:** Query A is the **high-recall** strategy, and Query B is the **high-precision** strategy.

## Web of Science

```text
(("cardiac arrest" OR "heart arrest" OR resuscitation OR CPR OR ROSC OR "return of spontaneous circulation")
 AND
 ("quality of life" OR HRQoL OR QoL OR "health-related quality of life" OR PROM* OR "patient reported outcome*" OR "patient-reported outcome*" OR "patient-reported" OR "health status")
 AND
 (survivor* OR survivorship OR follow-up OR "follow up" OR long-term OR postdischarge OR "post discharge" OR postresuscitation OR "post-resuscitation" OR "post-cardiac arrest" OR "post cardiac arrest" OR OHCA OR IHCA OR "out-of-hospital" OR "out of hospital" OR "in-hospital" OR "in hospital"))
```

## EBSCO (CINAHL)

### Query A (HRQoL)

```text
(
  (MH "Heart Arrest+")
  OR (MH "Cardiopulmonary Resuscitation+")
  OR TI ("cardiac arrest" OR "heart arrest" OR resuscitation OR CPR OR ROSC OR "return of spontaneous circulation")
  OR AB ("cardiac arrest" OR "heart arrest" OR resuscitation OR CPR OR ROSC OR "return of spontaneous circulation")
)
AND
(
  (MH "Quality of Life+")
  OR (MH "Patient Reported Outcome Measures+")
  OR TI ("quality of life" OR HRQoL OR QoL OR "health-related quality of life" OR PROM* OR "patient reported outcome*" OR "patient-reported outcome*" OR "patient-reported" OR "health status")
  OR AB ("quality of life" OR HRQoL OR QoL OR "health-related quality of life" OR PROM* OR "patient reported outcome*" OR "patient-reported outcome*" OR "patient-reported" OR "health status")
)
```

### Query B (HRQoL + instrument filter)

```text
(
  (MH "Heart Arrest+")
  OR (MH "Cardiopulmonary Resuscitation+")
  OR TI ("cardiac arrest" OR "heart arrest" OR resuscitation OR CPR OR ROSC OR "return of spontaneous circulation")
  OR AB ("cardiac arrest" OR "heart arrest" OR resuscitation OR CPR OR ROSC OR "return of spontaneous circulation")
)
AND
(
  (MH "Quality of Life+")
  OR (MH "Patient Reported Outcome Measures+")
  OR TI ("quality of life" OR HRQoL OR QoL OR "health-related quality of life" OR PROM* OR "patient reported outcome*" OR "patient-reported outcome*" OR "patient-reported" OR "health status")
  OR AB ("quality of life" OR HRQoL OR QoL OR "health-related quality of life" OR PROM* OR "patient reported outcome*" OR "patient-reported outcome*" OR "patient-reported" OR "health status")
)
AND
(
  TI (survivor* OR survivorship OR follow-up OR "follow up" OR long-term OR postdischarge OR "post discharge" OR postresuscitation OR "post-resuscitation" OR "post-cardiac arrest" OR "post cardiac arrest" OR OHCA OR IHCA OR "out-of-hospital" OR "out of hospital" OR "in-hospital" OR "in hospital")
  OR AB (survivor* OR survivorship OR follow-up OR "follow up" OR long-term OR postdischarge OR "post discharge" OR postresuscitation OR "post-resuscitation" OR "post-cardiac arrest" OR "post cardiac arrest" OR OHCA OR IHCA OR "out-of-hospital" OR "out of hospital" OR "in-hospital" OR "in hospital")
)
AND
(
  EQ-5D OR EQ5D OR "EQ-5D-5L" OR EQ5D5L OR "EQ5D-5L" OR EuroQol OR "EQ VAS"
  OR "SF-36" OR SF36 OR "SF 36"
  OR "SF-12" OR SF12 OR "SF 12"
  OR "SF-8" OR SF8 OR "SF 8"
  OR "RAND-36" OR RAND36
  OR "SF-6D" OR SF6D
  OR "Health Utilities Index" OR HUI2 OR HUI3
  OR "15D"
  OR "Nottingham Health Profile" OR NHP
  OR "Sickness Impact Profile" OR SIP
  OR WHOQOL OR "WHOQOL-BREF" OR "WHOQOL BREF"
  OR "Quality of Well-Being" OR QWB
  OR PROMIS OR "PROMIS Global" OR "PROMIS-29" OR "Global Health"
  OR "VR-12" OR VR12 OR "VR 12"
  OR "VR-36" OR VR36 OR "VR 36"
  OR "Duke Health Profile"
  OR QOLIBRI
)
```

## PubMed

### QUERY_A

```text
(
  "Heart Arrest"[Mesh]
  OR "Cardiopulmonary Resuscitation"[Mesh]
  OR "Out-of-Hospital Cardiac Arrest"[Mesh]
  OR "cardiac arrest"[tiab]
  OR "heart arrest"[tiab]
  OR resuscitation[tiab]
  OR CPR[tiab]
  OR ROSC[tiab]
  OR "return of spontaneous circulation"[tiab]
)
AND
(
  survivor*[tiab]
  OR survivorship[tiab]
  OR follow-up[tiab]
  OR "follow up"[tiab]
  OR long-term[tiab]
  OR postdischarge[tiab]
  OR "post discharge"[tiab]
  OR postresuscitation[tiab]
  OR "post-resuscitation"[tiab]
  OR "post-cardiac arrest"[tiab]
  OR "post cardiac arrest"[tiab]
  OR OHCA[tiab]
  OR IHCA[tiab]
  OR "out-of-hospital"[tiab]
  OR "out of hospital"[tiab]
  OR "in-hospital"[tiab]
  OR "in hospital"[tiab]
)
AND
(
  "Quality of Life"[Mesh]
  OR "Patient Reported Outcome Measures"[Mesh]
  OR "quality of life"[tiab]
  OR HRQoL[tiab]
  OR QoL[tiab]
  OR "health-related quality of life"[tiab]
  OR PROM*[tiab]
  OR "patient reported outcome*"[tiab]
  OR "patient-reported outcome*"[tiab]
  OR "health status"[tiab]
  OR "patient-reported"[tiab]
)
NOT
(
  animals[mh] NOT humans[mh]
)
```

### QUERY_B

```text
(
  (
    "Heart Arrest"[Mesh]
    OR "Cardiopulmonary Resuscitation"[Mesh]
    OR "Out-of-Hospital Cardiac Arrest"[Mesh]
    OR "cardiac arrest"[tiab]
    OR "heart arrest"[tiab]
    OR resuscitation[tiab]
    OR CPR[tiab]
    OR ROSC[tiab]
    OR "return of spontaneous circulation"[tiab]
  )
  AND
  (
    survivor*[tiab]
    OR survivorship[tiab]
    OR follow-up[tiab]
    OR "follow up"[tiab]
    OR long-term[tiab]
    OR postdischarge[tiab]
    OR "post discharge"[tiab]
    OR postresuscitation[tiab]
    OR "post-resuscitation"[tiab]
    OR "post-cardiac arrest"[tiab]
    OR "post cardiac arrest"[tiab]
    OR OHCA[tiab]
    OR IHCA[tiab]
    OR "out-of-hospital"[tiab]
    OR "out of hospital"[tiab]
    OR "in-hospital"[tiab]
    OR "in hospital"[tiab]
  )
  AND
  (
    "Quality of Life"[Mesh]
    OR "Patient Reported Outcome Measures"[Mesh]
    OR "quality of life"[tiab]
    OR HRQoL[tiab]
    OR QoL[tiab]
    OR "health-related quality of life"[tiab]
    OR PROM*[tiab]
    OR "patient reported outcome*"[tiab]
    OR "patient-reported outcome*"[tiab]
    OR "health status"[tiab]
    OR "patient-reported"[tiab]
  )
)
AND
(
  EQ-5D[tiab] OR EQ5D[tiab] OR EQ-5D-5L[tiab] OR EQ5D5L[tiab] OR EQ5D-5L[tiab] OR EuroQol[tiab] OR "EQ VAS"[tiab]
  OR "SF-36"[tiab] OR SF36[tiab] OR "SF 36"[tiab]
  OR "SF-12"[tiab] OR SF12[tiab] OR "SF 12"[tiab]
  OR "SF-8"[tiab] OR SF8[tiab] OR "SF 8"[tiab]
  OR "RAND-36"[tiab] OR RAND36[tiab]
  OR "SF-6D"[tiab] OR SF6D[tiab]
  OR "Health Utilities Index"[tiab] OR HUI2[tiab] OR HUI3[tiab]
  OR "15D"[tiab]
  OR "Nottingham Health Profile"[tiab] OR NHP[tiab]
  OR "Sickness Impact Profile"[tiab] OR SIP[tiab]
  OR WHOQOL[tiab] OR "WHOQOL-BREF"[tiab] OR "WHOQOL BREF"[tiab]
  OR "Quality of Well-Being"[tiab] OR QWB[tiab]
  OR PROMIS[tiab] OR "PROMIS Global"[tiab] OR "Global Health"[tiab] OR "PROMIS-29"[tiab]
  OR "VR-12"[tiab] OR VR12[tiab] OR "VR 12"[tiab]
  OR "VR-36"[tiab] OR VR36[tiab] OR "VR 36"[tiab]
  OR "Duke Health Profile"[tiab]
  OR QOLIBRI[tiab]
)
NOT
(
  animals[mh] NOT humans[mh]
)
```

> Note: the mixed `TI/AB` block at the very end of the provided PubMed `QUERY_B` text appears to be EBSCO syntax and is intentionally not included in the cleaned PubMed query.
