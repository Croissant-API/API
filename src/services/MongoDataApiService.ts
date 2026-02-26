// src/services/MongoDataApiService.ts
import { injectable } from 'inversify';
import 'isomorphic-fetch'; // szip polyfill if you like

type Filter = Record<string, any>;

@injectable()
export class MongoDataApiService {
    private base = process.env.MONGODB_DATA_API_URL!;
    private key = process.env.MONGODB_DATA_API_KEY!;

    private async call(body: unknown) {
        const res = await fetch(`${this.base}/action/find`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': this.key,
            },
            body: JSON.stringify(body),
        });
        return res.json();
    }

    async findOne(db: string, coll: string, filter: Filter) {
        const { document } = await this.call({
            dataSource: 'Cluster0',
            database: db,
            collection: coll,
            filter
        });
        return document;
    }

    async insert(db: string, coll: string, doc: unknown) {
        return this.call({
            dataSource: 'Cluster0',
            database: db,
            collection: coll,
            document: doc
        });
    }

    // …other helpers (update, delete, aggregate) …
}