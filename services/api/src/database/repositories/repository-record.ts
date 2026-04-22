export type MongoObject<T> = T & {
    _id: unknown;
    createdAt?: Date;
    updatedAt?: Date;
};

export type RepositoryRecord<T> = T & {
    _id: string;
    id: string;
    createdAt?: Date;
    updatedAt?: Date;
};

export function toRecord<T>(doc: MongoObject<T>): RepositoryRecord<T> {
    const id = String(doc._id);

    return { ...doc, _id: id, id } as RepositoryRecord<T>;
}
