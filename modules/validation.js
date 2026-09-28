/**
 * GAITMATRIX / OA-Sense - Validation Framework & Limitations Module
 * 5-Stage Engineering to Clinical Validation Pipeline & Scientific Constraints
 * 
 * Defines the rigorous progression:
 * Stage 1: Hardware & Sensor Validation
 * Stage 2: Normal Movement Trials
 * Stage 3: Proxy Engineering Stress Testing (Controlled restriction - NO OA CLAIM)
 * Stage 4: Expert-Guided Clinical Study (Future)
 * Stage 5: Rigorous Holdout Model Evaluation (Future)
 */

export const VALIDATION_FRAMEWORK = {
    currentStatus: {
        currentStage: 3,
        currentStageLabel: 'Stage 3: Engineering & Proxy Validation',
        futureStageLabel: 'Stages 4 & 5: Clinical Study & Diagnostic Concordance (Future)',
        disclaimer: 'Current prototype is at the Engineering & Proxy Validation stage. Clinical deployment requires Institutional Review Board (IRB) approval, consented participants, and diagnostic reference standards (e.g. Kellgren-Lawrence radiography).'
    },

    stages: [
        {
            stageNumber: 1,
            name: 'Hardware & Signal Validation',
            type: 'Engineering Verification',
            status: 'COMPLETED (PROTOTYPE)',
            objectives: [
                'Verify 100 Hz synchronized IMU/FSR data acquisition with < 2ms clock jitter',
                'Quantify accelerometer & gyroscope zero-velocity drift rates under static conditions',
                'Validate FSR analog linearity, contact thresholds, and hysteresis recovery times',
                'Confirm packet loss rate < 0.05% across wireless/wired communication channels'
            ],
            metrics: ['Sampling Jitter (< 2 ms)', 'IMU Drift (< 0.1 deg/s)', 'Packet Loss (< 0.05%)', 'FSR Tare Stability'],
            findings: 'Hardware architecture meets timing constraints for human gait bandwidth (< 10 Hz).'
        },
        {
            stageNumber: 2,
            name: 'Standardized Movement Trials',
            type: 'Biomechanical Verification',
            status: 'COMPLETED (SIMULATED)',
            objectives: [
                'Evaluate gait cycle segmentation repeatability across self-paced level walking',
                'Assess Sit-to-Stand and 6-meter walk test feature stability across repeated trials',
                'Validate relative quaternion thigh-shank orientation against simulated goniometer benchmarks',
                'Check intra-subject gait cycle coefficient of variation (CV < 6%)'
            ],
            metrics: ['Gait Cycle Repeatability (CV < 6%)', 'Relative ROM Accuracy', 'Stance/Swing Ratio Consistency'],
            findings: 'Segmenter reliably isolates initial contact (IC) and toe-off (TO) events across varied walking speeds.'
        },
        {
            stageNumber: 3,
            name: 'Proxy Engineering Stress Testing',
            type: 'Proxy Stress Test',
            status: 'CURRENT PHASE',
            objectives: [
                'Simulate controlled knee flexion restriction (e.g. brace constraint) to test pipeline sensitivity',
                'Stress-test feature extraction under induced asymmetry and antalgic loading patterns',
                'Evaluate model classification boundary responsiveness to artificial biomechanical deviations'
            ],
            criticalCaution: 'IMPORTANT: Controlled movement restriction serves purely as a software/hardware stress test. It is NOT clinical osteoarthritis.',
            metrics: ['Feature Sensitivity to Restriction', 'Pipeline Robustness to Asymmetry', 'Decision Boundary Stability'],
            findings: 'Software pipeline accurately tracks reduced ROM and asymmetric plantar load shifting under proxy conditions.'
        },
        {
            stageNumber: 4,
            name: 'Expert-Guided Clinical Study',
            type: 'Clinical Investigation',
            status: 'FUTURE PHASE (PLANNED)',
            objectives: [
                'Obtain Institutional Ethics Committee (IEC) / IRB approval and patient informed consent',
                'Recruit diverse demographic cohort (rural agrarian vs urban, age 40-80, male/female)',
                'Establish radiographic reference standard (Kellgren-Lawrence grading via blinded musculoskeletal radiologists)',
                'Collect verified, timestamped multimodal raw sensor database under supervised clinical protocols'
            ],
            metrics: ['Radiographic Reference Concordance', 'Inter-Observer Radiologist Agreement', 'Adverse Event Rate (0%)'],
            findings: 'Required before claiming clinical diagnostic relevance or medical utility.'
        },
        {
            stageNumber: 5,
            name: 'Clinical Model Evaluation & Generalization',
            type: 'Clinical ML Validation',
            status: 'FUTURE PHASE (PLANNED)',
            objectives: [
                'Perform multi-center participant-level holdout validation with external test cohorts',
                'Calculate clinical Sensitivity, Specificity, Positive Predictive Value (PPV), and ROC-AUC',
                'Conduct calibration curves (Brier score) and subgroup fairness analysis across age and sex',
                'Publish open peer-reviewed validation results adhering to STARD and TRIPOD-AI guidelines'
            ],
            metrics: ['Sensitivity & Specificity', 'ROC-AUC & Precision-Recall AUC', 'Brier Calibration Score', 'Subgroup Fairness'],
            findings: 'Final threshold for field deployment and clinical screening decision support.'
        }
    ],

    limitations: [
        {
            category: 'Biomechanical Variability',
            points: [
                'Gait biomechanics naturally vary with age, sex, height, body mass index (BMI), walking speed, and fatigue.',
                'Altered movement kinematics and loading asymmetry are NOT unique to osteoarthritis; they occur in meniscus tears, ligamentous laxity, lumbar radiculopathy, peripheral neuropathy, or temporary soft-tissue soreness.',
                'Footwear type (sandals, athletic shoes, barefoot) significantly alters plantar force distribution and heel impact shock.'
            ]
        },
        {
            category: 'Sensor & Hardware Constraints',
            points: [
                'IMU orientation estimation is prone to integration drift if zero-velocity updates or static calibrations are neglected.',
                'Sensor attachment slippage or soft-tissue artifact (wobbling muscle mass) can distort high-frequency acceleration signals.',
                'FSR insole arrays provide relative plantar loading and center-of-pressure proxies rather than absolute clinical force measurement (in kPa/Newtons).',
                'Single monocular camera pose tracking depends on lighting conditions, lateral viewing perspective, and loose-fitting clothing.'
            ]
        },
        {
            category: 'Machine Learning & Screening Boundaries',
            points: [
                'Screening risk tiers (Low, Moderate, Elevated) represent statistical classification outputs, NOT radiographic disease grades (Kellgren-Lawrence 0-4).',
                'Feature importance charts describe which kinematic metrics the tree ensemble utilized, NOT direct medical etiology (e.g. low ROM does not cause OA).',
                'Software outputs are strictly for clinical referral decision support to prioritize individuals who may benefit from professional medical examination.'
            ]
        }
    ]
};
