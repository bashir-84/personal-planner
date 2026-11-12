export type Version={clientUpdatedAt:string;operationId:string};
export function incomingWins(incoming:Version,current?:Version){return!current||incoming.clientUpdatedAt>current.clientUpdatedAt||incoming.clientUpdatedAt===current.clientUpdatedAt&&incoming.operationId>current.operationId}
