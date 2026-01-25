# Scoring Rubric Reference

This document outlines the standardized 1-10 scoring scale used in the Gab Guide AI analysis. The scale is aligned with international language proficiency standards (CEFR and IELTS) to ensure consistency and reliability.

## Color Coding
The application uses color coding to give immediate visual feedback based on the score:
- 🔴 **Red (1-3):** Beginner / Foundation (Pre-A1 to A1)
- 🟡 **Amber (4-6):** Intermediate / Independent (A2 to B1)
- 🟢 **Green (7-10):** Advanced / Proficient (B2 to C2)

## Grammar Score (1-10)
*Based on IELTS Grammatical Range & Accuracy and CEFR Grammar Criteria*

| Score | Color | CEFR | IELTS | Description |
|:-----:|:-----:|:----:|:-----:|:------------|
| **1** | 🔴 | Pre-A1 | Band 1 | **Severe Communication Breakdown:** Cannot form basic sentences. Fundamental grammar missing. |
| **2** | 🔴 | Pre-A1 | Band 2 | **Minimal Communication:** Only isolated words or memorized fragments. Severe errors in every attempt. |
| **3** | 🔴 | A1 | Band 3 | **Very Basic:** Attempts simple sentences but frequent basic errors (tense, agreement) often obscure meaning. |
| **4** | 🟡 | A1 | Band 4 | **Basic & Limited:** Can use simple structure but errors are frequent. Limited to present/past simple. |
| **5** | 🟡 | A2 | Band 5 | **Functional but Flawed:** Uses basic structures reasonably well. Regular errors in complex attempts. |
| **6** | 🟡 | B1 | Band 5.5-6 | **Reasonable Accuracy:** Good control in familiar contexts. Errors occur but rarely impede communication. |
| **7** | 🟢 | B2 | Band 6.5-7 | **Good Control:** Uses a range of complex structures. Errors are infrequent and minor (slips). |
| **8** | 🟢 | B2+ | Band 7.5 | **Consistent Accuracy:** Wide range of structures used accurately. Occasional errors only in very complex forms. |
| **9** | 🟢 | C1 | Band 8-8.5 | **Precise & Sophisticated:** Full range of structures. Errors are rare, minor, and difficult to spot. |
| **10** | 🟢 | C2 | Band 9 | **Native-like Mastery:** Consistent grammatical control of complex language. Near-perfect accuracy. |

## Naturalness / Flow Score (1-10)
*Based on IELTS Fluency & Coherence and CEFR Naturalness Criteria*

| Score | Color | CEFR | IELTS | Description |
|:-----:|:-----:|:----:|:-----:|:------------|
| **1** | 🔴 | Pre-A1 | Band 1 | **Robotic:** Long pauses between every word. No flow. |
| **2** | 🔴 | Pre-A1 | Band 2 | **Disjointed:** Isolated words only. Very hard to follow. |
| **3** | 🔴 | A1 | Band 3 | **Stilted:** Very slow speech. Heavy reliance on translation. Frequent, long hesitations. |
| **4** | 🟡 | A1 | Band 4 | **Textbook-like:** Dependent on pre-packaged phrases. Lacks conversational markers. |
| **5** | 🟡 | A2 | Band 5 | **Halting:** Functional but requires effort. Noticeable false starts and reformulations. |
| **6** | 🟡 | B1 | Band 5.5-6 | **Understandable Flow:** Can maintain flow in linear sequence. Some non-native rhythm and phrasing. |
| **7** | 🟢 | B2 | Band 6.5-7 | **Mostly Natural:** Good use of connectors and conversational markers (well, you know). Minor awkwardness. |
| **8** | 🟢 | B2+ | Band 7.5 | **Fluid:** Natural flow and rhythm. Good command of colloquialisms. Occasional non-native patterns. |
| **9** | 🟢 | C1 | Band 8-8.5 | **Effortless:** Spontaneous and fluent. Very rare unnatural expressions. |
| **10** | 🟢 | C2 | Band 9 | **Indistinguishable from Native:** Perfect command of idioms, cultural references, and nuance. |

## Evaluation Guidelines for AI

### Consistency Rule
**The overall conversation summary score MUST map to the average of individual message scores.**
- If a user consistently scores 6-7 on individual messages, the summary score must be in the 6-7 range.
- It is technically impossible to have a summary score of 9 if all individual messages were rated 5.

### Naturalness Markers
- **Positive Indicators:** Appropriate use of hesitation markers ("um", "well", "let me see"), colloquialisms, and idiomatic phrasal verbs.
- **Negative Indicators:** overly formal "textbook" language in a casual setting, robotic sentence structure, direct translation of idioms from L1.
