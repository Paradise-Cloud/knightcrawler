import { Sequelize } from 'sequelize';
import { databaseConfig } from './config.js';

const { Op } = Sequelize;

const database = new Sequelize(
    databaseConfig.POSTGRES_URI,
    {
        logging: false,
        dialect: "postgres", dialectOptions: {
            ssl: {
              require: true,
              rejectUnauthorized: false
            }
          }
    }
);

const Torrent = database.define('torrent',
    {
        infoHash: { type: Sequelize.STRING(64), primaryKey: true },
        provider: { type: Sequelize.STRING(32), allowNull: false },
        ingestedTorrentId: { type: Sequelize.BIGINT, allowNull: false },
        title: { type: Sequelize.STRING(256), allowNull: false },
        size: { type: Sequelize.BIGINT },
        type: { type: Sequelize.STRING(16), allowNull: false },
        uploadDate: { type: Sequelize.DATE, allowNull: false },
        seeders: { type: Sequelize.SMALLINT },
        languages: { type: Sequelize.STRING(4096) },
        resolution: { type: Sequelize.STRING(16) }
    }
);

const File = database.define('file',
    {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        infoHash: {
            type: Sequelize.STRING(64),
            allowNull: false,
            references: { model: Torrent, key: 'infoHash' },
            onDelete: 'CASCADE'
        },
        fileIndex: { type: Sequelize.INTEGER },
        title: { type: Sequelize.STRING(256), allowNull: false },
        size: { type: Sequelize.BIGINT },
        imdbId: { type: Sequelize.STRING(32) },
        imdbSeason: { type: Sequelize.INTEGER },
        imdbEpisode: { type: Sequelize.INTEGER },
        kitsuId: { type: Sequelize.INTEGER },
        kitsuEpisode: { type: Sequelize.INTEGER }
    },
);

const Subtitle = database.define('subtitle',
    {
        infoHash: {
            type: Sequelize.STRING(64),
            allowNull: false,
            references: { model: Torrent, key: 'infoHash' },
            onDelete: 'CASCADE'
        },
        fileIndex: { type: Sequelize.INTEGER, allowNull: false },
        fileId: {
            type: Sequelize.BIGINT,
            allowNull: true,
            references: { model: File, key: 'id' },
            onDelete: 'SET NULL'
        },
        title: { type: Sequelize.STRING(512), allowNull: false },
        size: { type: Sequelize.BIGINT, allowNull: false },
    },
    { timestamps: false }
);

Torrent.hasMany(File, { foreignKey: 'infoHash', constraints: false });
File.belongsTo(Torrent, { foreignKey: 'infoHash', constraints: false });
File.hasMany(Subtitle, { foreignKey: 'fileId', constraints: false });
Subtitle.belongsTo(File, { foreignKey: 'fileId', constraints: false });

export function getTorrent(infoHash) {
    return Torrent.findOne({ where: { infoHash: infoHash } });
}

export function getFiles(infoHashes) {
    return File.findAll({ where: { infoHash: { [Op.in]: infoHashes } } });
}

export function getImdbIdMovieEntries(imdbId) {
    return File.findAll({
        where: {
            imdbId: { [Op.eq]: imdbId }
        },
        include: { model: Torrent, required: true },
        limit: 500,
        order: [
            [Torrent, 'size', 'DESC']
        ]
    });
}

export function getImdbIdSeriesEntries(imdbId, season, episode) {
    return File.findAll({
        where: {
            imdbId: { [Op.eq]: imdbId },
            imdbSeason: { [Op.eq]: season },
            imdbEpisode: { [Op.eq]: episode }
        },
        include: { model: Torrent, required: true },
        limit: 500,
        order: [
            [Torrent, 'size', 'DESC']
        ]
    });
}

export function getKitsuIdMovieEntries(kitsuId) {
    return File.findAll({
        where: {
            kitsuId: { [Op.eq]: kitsuId }
        },
        include: { model: Torrent, required: true },
        limit: 500,
        order: [
            [Torrent, 'size', 'DESC']
        ]
    });
}

export function getKitsuIdSeriesEntries(kitsuId, episode) {
    return File.findAll({
        where: {
            kitsuId: { [Op.eq]: kitsuId },
            kitsuEpisode: { [Op.eq]: episode }
        },
        include: { model: Torrent, required: true },
        limit: 500,
        order: [
            [Torrent, 'size', 'DESC']
        ]
    });
}


export async function computeTorrentStatistics() {
  try {
    // Global Stats
    const totalTorrents = await Torrent.count();

    // Stats by Provider
    const torrentsByProvider = await Torrent.findAll({
      attributes: ['provider', [Sequelize.fn('COUNT', Sequelize.col('provider')), 'count']],
      group: ['provider']
    });

    // Stats by Content Type (Movie, Series, etc.)
    const torrentsByType = await Torrent.findAll({
      attributes: ['type', [Sequelize.fn('COUNT', Sequelize.col('type')), 'count']],
      group: ['type']
    });

    return {
      totalTorrents,
      torrentsByProvider,
      torrentsByType,
    };
  } catch (error) {
    console.error('Error computing statistics:', error);
    throw error;
  }
}
