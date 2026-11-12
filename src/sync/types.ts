import type {PlannerState} from "@/domain/types";

export type SyncEntityType="task"|"project"|"appointment"|"dailyCapacity"|"confirmed"|"settings";
export type SyncPatch=Record<string,unknown>;
export type SyncOperation={operationId:string;deviceId:string;entityType:SyncEntityType;entityId:string;patch:SyncPatch;clientUpdatedAt:string};
export type FieldVersion={entityType:SyncEntityType;entityId:string;field:string;clientUpdatedAt:string;operationId:string};
export type ServerFieldVersion={clientUpdatedAt:string;operationId:string};
export type ServerChange={entityType:SyncEntityType;entityId:string;patch:SyncPatch;versions:Record<string,ServerFieldVersion>;sequence:number};
export type SyncResponse={ok:true;nextCursor:number;appliedOperationIds:string[];ignoredOperationIds:string[];changes:ServerChange[];serverTime:string};
export type SyncErrorResponse={ok:false;error:{code:string;message:string}};
export type SyncConnection={id:"connection";deviceId:string;syncKey?:string;cursor:number;lastSuccessfulSync?:string;lastError?:string};
export type SyncSummary={connected:boolean;pending:number;lastSuccessfulSync?:string;lastError?:string;syncing:boolean;offline:boolean};
export type SyncJoinMode="use-cloud"|"merge-local";
export type SyncResult={state:PlannerState;response:SyncResponse};

export const SYNC_ENDPOINT="https://personal-planner-sync.bashiramri84.workers.dev/v1/sync";
export const UNSET={__plannerSyncUnset:true} as const;
