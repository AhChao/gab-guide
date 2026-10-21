/**
 * JSON backup of everything the learner owns locally: the Expression Bank, saved
 * check-ins and check-in comparisons. IndexedDB is per browser profile, so this file is
 * the only way to move data between devices or survive clearing site data.
 *
 * Pitfalls:
 * - Fail closed: `parseBackup` validates the whole file before anything is written. One
 *   bad record rejects the file; there is no partial import. Error messages are shown to
 *   the learner as-is, so they are one plain sentence.
 * - `schemaVersion` newer than BACKUP_SCHEMA_VERSION is rejected: an older app must not
 *   guess at fields it does not know. When BANK_SCHEMA_VERSION or CHECKIN_SCHEMA_VERSION
 *   changes, bump BACKUP_SCHEMA_VERSION and migrate older files in `parseBackup`.
 * - merge: expressions keep whichever copy has the newer `updatedAt` (ties keep the
 *   local copy); check-ins with an existing id keep the local copy; comparisons with the
 *   same A/B pair keep the newer `at`. Merge matches by id only, so the same phrase saved
 *   on two devices under different ids ends up as two items.
 * - replace: clears all three stores, then writes. IndexedDB transactions do not span our
 *   adapters, so a crash between clear and write leaves the stores empty; export first.
 * - Counts returned by `importBackup` are records actually written.
 */

import { BANK_SCHEMA_VERSION, Expression, MASTERY_ORDER, MasteryState } from './model';
import { CHECKIN_SCHEMA_VERSION, CheckIn, CheckInComparison } from '../progress/model';
import { BankStore } from './store';
import { CheckinStore, comparisonKey } from '../progress/store';

/** One number for the whole file. Bump when either the bank or the check-in schema changes. */
export const BACKUP_SCHEMA_VERSION = Math.max(BANK_SCHEMA_VERSION, CHECKIN_SCHEMA_VERSION);

export interface BackupFile {
    app: 'gab-guide';
    schemaVersion: number;
    exportedAt: number;
    expressions: Expression[];
    checkins: CheckIn[];
    comparisons: CheckInComparison[];
}

export async function exportBackup(bank: BankStore, checkins: CheckinStore, now: number = Date.now()): Promise<string> {
    const [expressions, savedCheckins, comparisons] = await Promise.all([
        bank.list(),
        checkins.list(),
        checkins.listComparisons(),
    ]);
    const file: BackupFile = {
        app: 'gab-guide',
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: now,
        expressions,
        checkins: savedCheckins,
        comparisons,
    };
    return JSON.stringify(file, null, 2);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isOptString = (v: unknown): boolean => v === undefined || typeof v === 'string';

function isAttempt(v: unknown): boolean {
    return isObject(v)
        && isNum(v.at)
        && (v.kind === 'recall' || v.kind === 'transfer')
        && typeof v.used === 'boolean'
        && isOptString(v.evidence)
        && isOptString(v.conversationId);
}

function isExpression(v: unknown): v is Expression {
    return isObject(v)
        && isNonEmptyString(v.id)
        && isNonEmptyString(v.phrase)
        && isNonEmptyString(v.concept)
        && typeof v.language === 'string'
        && (v.source === 'learner' || v.source === 'partner' || v.source === 'manual')
        && MASTERY_ORDER.includes(v.state as MasteryState)
        && Array.isArray(v.attempts) && v.attempts.every(isAttempt)
        && isNum(v.nextReviewAt)
        && isNum(v.stateChangedAt)
        && isNum(v.streak) && v.streak >= 0
        && isNum(v.createdAt)
        && isNum(v.updatedAt)
        && isOptString(v.original) && isOptString(v.contrast) && isOptString(v.example) && isOptString(v.transferPrompt)
        && (v.archived === undefined || typeof v.archived === 'boolean');
}

function isCheckIn(v: unknown): v is CheckIn {
    return isObject(v)
        && isNonEmptyString(v.id)
        && isNum(v.at)
        && isNum(v.scriptVersion)
        && typeof v.language === 'string'
        && Array.isArray(v.messages)
        && v.messages.every(m => isObject(m) && typeof m.text === 'string' && (m.role === 'user' || m.role === 'assistant'))
        && isObject(v.metrics)
        && isOptString(v.note);
}

function isComparison(v: unknown): v is CheckInComparison {
    return isObject(v)
        && isNonEmptyString(v.aId)
        && isNonEmptyString(v.bId)
        && typeof v.graderModel === 'string'
        && isNum(v.at)
        && Array.isArray(v.dimensions)
        && typeof v.summary === 'string';
}

function hasDuplicateIds(ids: string[]): boolean {
    return new Set(ids).size !== ids.length;
}

/** Validate a backup file. Throws an Error with a learner-readable message on anything unexpected. */
export function parseBackup(json: string): BackupFile {
    let data: unknown;
    try {
        data = JSON.parse(json);
    } catch {
        throw new Error('This file is not a valid backup file.');
    }
    if (!isObject(data) || data.app !== 'gab-guide') {
        throw new Error('This file is not a Gab Guide backup.');
    }
    const version = data.schemaVersion;
    if (!isNum(version) || !Number.isInteger(version) || version < 1) {
        throw new Error('This backup file is damaged and cannot be imported.');
    }
    if (version > BACKUP_SCHEMA_VERSION) {
        throw new Error('This backup was made by a newer version of the app. Please update the app and try again.');
    }
    if (!Array.isArray(data.expressions)) {
        throw new Error('This backup file is damaged and cannot be imported.');
    }
    const checkins = data.checkins ?? [];
    const comparisons = data.comparisons ?? [];
    if (!Array.isArray(checkins) || !Array.isArray(comparisons)) {
        throw new Error('This backup file is damaged and cannot be imported.');
    }
    if (!data.expressions.every(isExpression)) {
        throw new Error('Some saved expressions in this backup are damaged, so nothing was imported.');
    }
    if (!checkins.every(isCheckIn) || !comparisons.every(isComparison)) {
        throw new Error('Some saved check-ins in this backup are damaged, so nothing was imported.');
    }
    if (hasDuplicateIds(data.expressions.map(e => e.id)) || hasDuplicateIds(checkins.map(c => c.id))) {
        throw new Error('This backup file is damaged and cannot be imported.');
    }
    return {
        app: 'gab-guide',
        schemaVersion: version,
        exportedAt: isNum(data.exportedAt) ? data.exportedAt : 0,
        expressions: data.expressions,
        checkins,
        comparisons,
    };
}

export async function importBackup(
    file: BackupFile,
    bank: BankStore,
    checkins: CheckinStore,
    mode: 'merge' | 'replace',
): Promise<{ expressions: number; checkins: number }> {
    if (mode === 'replace') {
        await bank.clear();
        await checkins.clear();
        await bank.putRaw(file.expressions);
        await checkins.putRaw(file.checkins);
        await checkins.putRawComparisons(file.comparisons);
        return { expressions: file.expressions.length, checkins: file.checkins.length };
    }

    const localExpr = new Map((await bank.list()).map(e => [e.id, e]));
    const exprToWrite = file.expressions.filter(e => {
        const local = localExpr.get(e.id);
        return !local || e.updatedAt > local.updatedAt;
    });

    const localCheckinIds = new Set((await checkins.list()).map(c => c.id));
    const checkinsToWrite = file.checkins.filter(c => !localCheckinIds.has(c.id));

    const localCmp = new Map((await checkins.listComparisons()).map(c => [comparisonKey(c), c]));
    const cmpToWrite = file.comparisons.filter(c => {
        const local = localCmp.get(comparisonKey(c));
        return !local || c.at > local.at;
    });

    await bank.putRaw(exprToWrite);
    await checkins.putRaw(checkinsToWrite);
    await checkins.putRawComparisons(cmpToWrite);
    return { expressions: exprToWrite.length, checkins: checkinsToWrite.length };
}
