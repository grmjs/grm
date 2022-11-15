// deno-lint-ignore-file no-explicit-any
import { Api } from "../tl/api.js";
import { MemorySession } from "./memory_session.ts";
import { AuthKey } from "../crypto/authkey.ts";
import { bigInt, Buffer, denodb } from "../../deps.ts";
import { getPeerId } from "../utils.ts";
import { returnBigInt } from "../helpers.ts";

const DataTypes = denodb.DataTypes;

class Session extends denodb.Model {
  static timestamps = true;
  static fields = {
    name: { type: DataTypes.STRING, primaryKey: true },
    dcId: DataTypes.STRING,
    port: DataTypes.INTEGER,
    serverAddress: DataTypes.STRING,
    authKey: DataTypes.BINARY,
  };
}

class Entity extends denodb.Model {
  static timestamps = true;
  static fields = {
    id: { type: DataTypes.STRING, primaryKey: true },
    hash: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    username: DataTypes.STRING,
    phone: DataTypes.STRING,
  };
}

export enum DatabaseType {
  Postgres = "Postgres",
  MySQL = "MySQL",
  MariaDB = "MariaDB",
  SQLite = "SQLite",
  MongoDB = "MongoDB",
}

type AdapterDetails =
  | { adapter: "Postgres"; adapterOptions: denodb.PostgresOptions }
  | { adapter: "MySQL" | "MariaDB"; adapterOptions: denodb.MySQLOptions }
  | { adapter: "SQLite"; adapterOptions: denodb.SQLite3Options }
  | { adapter: "MongoDB"; adapterOptions: denodb.MongoDBOptions };

export type ConnectionOptions =
  & AdapterDetails
  & { tables?: { session?: string; entity?: string } };

export class DatabaseSession extends MemorySession {
  public sessionName: string;
  private dbConnection: denodb.Database;
  private dbInitialized = false;
  private session?: Session;

  constructor(sessionName: string, connectionOptions: ConnectionOptions) {
    super();

    this.sessionName = sessionName;
    const tableNames = connectionOptions.tables || {};
    Session.table = tableNames.session || "sessions";
    Entity.table = tableNames.entity || "entities";

    let connector: denodb.DatabaseOptions;
    switch (connectionOptions.adapter) {
      case DatabaseType.Postgres:
        connector = new denodb.PostgresConnector(
          connectionOptions.adapterOptions,
        );
        break;
      case DatabaseType.MongoDB:
        connector = new denodb.MongoDBConnector(
          connectionOptions.adapterOptions,
        );
        break;
      case DatabaseType.MySQL:
      case DatabaseType.MariaDB:
        connector = new denodb.MySQLConnector(
          connectionOptions.adapterOptions,
        );
        break;
      case DatabaseType.SQLite:
        connector = new denodb.SQLite3Connector(
          connectionOptions.adapterOptions,
        );
        break;
      default:
        throw new Error("Database type not supported");
    }

    this.dbConnection = new denodb.Database({ debug: false, connector });
  }

  async load() {
    await this.configureDatabase();
    const session = this.session = await Session.where({
      name: this.sessionName,
    }).first();

    if (session) {
      if (session.authKey) {
        let authKey = JSON.parse(session.authKey as string);
        this._authKey = new AuthKey();
        if ("data" in authKey) {
          authKey = Buffer.from(authKey.data);
        }
        await this._authKey.setKey(authKey);
      }

      if (session.dcId) this._dcId = Number(session.dcId);
      if (session.serverAddress) {
        this._serverAddress = session.serverAddress as string;
      }
      if (session.port) this._port = session.port as number;

      await session.update();
    } else {
      this.session = await Session.create({ name: this.sessionName });
    }
  }

  async configureDatabase() {
    if (!this.dbInitialized) {
      this.dbConnection.link([Session, Entity]);
      await this.dbConnection.sync({ drop: false });
      this.dbInitialized = true;
    }
  }

  setDC(dcId: number, serverAddress: string, port: number): void {
    const session = this.session;
    if (session) {
      session.dcId = dcId;
      session.serverAddress = serverAddress;
      session.port = port;
      session.update();
    }
    super.setDC(dcId, serverAddress, port);
  }

  set authKey(value: AuthKey | undefined) {
    const session = this.session;
    if (session && value) {
      this._authKey = value;
      session.authKey = JSON.stringify(value.getKey());
      session.update();
    }
  }

  get authKey() {
    if (this._authKey) return this._authKey;
    return undefined;
  }

  async processEntities(tlo: any) {
    const rows = this._entitiesToRows(tlo);
    for (const row of rows) {
      const id = row[0];
      const model = await Entity.where({
        id: id.toString(),
        hash: row[1].toString(),
      }).first();
      if (model) {
        model.username = row[2] ? row[2].toString() : null;
        model.phone = row[3] ? row[3].toString() : null;
        model.name = row[4] ? row[4].toString() : null;
        await model.update();
      } else {
        // The above is to ensure we have a hash
        await Entity.create({
          id: id.toString(),
          hash: row[1] ? row[1].toString() : null,
          username: row[2] ? row[2].toString() : null,
          phone: row[3] ? row[3].toString() : null,
          name: row[4] ? row[4].toString() : null,
        });
      }
    }
  }

  async getEntityRowsByPhone(phone: string) {
    const row = await Entity.where("phone", phone).first();
    if (row) return [row.id, row.hash];
  }

  async getEntityRowsByUsername(username: string) {
    const row = await Entity.where("username", username).first();
    if (row) return [row.id, row.hash];
  }

  async getEntityRowsByName(name: string) {
    const row = await Entity.where("name", name).first();
    if (row) return [row.id, row.hash];
  }

  async getEntityRowsById(id: string | bigInt.BigInteger, exact = true) {
    if (exact) {
      const row = await Entity.find(id.toString());
      if (row) return [row.id, row.hash];
    } else {
      const ids = [
        getPeerId(new Api.PeerUser({ userId: returnBigInt(id) })),
        getPeerId(new Api.PeerChat({ chatId: returnBigInt(id) })),
        getPeerId(
          new Api.PeerChannel({ channelId: returnBigInt(id) }),
        ),
      ];
      for (const e of this._entities) {
        // id, hash, username, phone, name
        if (ids.includes(e[0])) {
          return [e[0], e[1]];
        }
      }
    }
  }
}
