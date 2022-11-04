import { FastifyInstance } from "fastify";
import { z } from 'zod';
import ShortUniqueId from "short-unique-id";
import { prisma } from "../lib/prisma";
import { authenticate } from "../plugins/authenticate";

export async function pollRoutes(fastify: FastifyInstance) {
  fastify.get('/polls/count', async () => {
    const count = await prisma.pool.count();

    return { count };
  });

  fastify.post('/polls', async (request, response) => {
    const createPoolBody = z.object({
      title: z.string(),
    });

    const { title } = createPoolBody.parse(request.body);

    const generate = new ShortUniqueId({ length: 6 });
    const code = String(generate()).toUpperCase();

    try {
      await request.jwtVerify();
      await prisma.pool.create({
        data: {
          title,
          code,
          ownerId: request.user.sub,

          participant: {
            create: {
              userId: request.user.sub,
            }
          }
        }
      });
    } catch {
      await prisma.pool.create({
        data: {
          title,
          code
        }
      });
    }


    return response.status(201).send({ code });
  });

  fastify.post('/polls/join', { onRequest: [authenticate] }, async (request, response) => {
    const joinPoolBody = z.object({
      code: z.string()
    });

    const { code } = joinPoolBody.parse(request.body);

    const pool = await prisma.pool.findUnique({
      where: {
        code
      },
      include: {
        participant: {
          where: {
            userId: request.user.sub,
          }
        }
      }
    });

    if (!pool) {
      return response.status(400).send({
        message: 'Pool not found'
      });
    };

    if (pool.participant.length > 0) {
      return response.status(400).send({
        message: 'You already joined this poll.'
      });
    }

    if (!pool.ownerId) {
      await prisma.pool.update({
        where: {
          id: pool.id,
        },
        data: {
          ownerId: request.user.sub,
        }
      });
    }

    await prisma.participant.create({
      data: {
        poolId: pool.id,
        userId: request.user.sub
      }
    });

    return response.status(201).send();
  });

  fastify.get('/polls', {
    onRequest: [authenticate]
  }, async (request) => {
    const pools = await prisma.pool.findMany({
      where: {
        participant: {
          some: {
            userId: request.user.sub
          }
        }
      },
      include: {
        _count: {
          select: {
            participant: true
          }
        },
        participant: {
          select: {
            id: true,
            user: {
              select: {
                avatarUrl: true,
              }
            }
          },
          take: 4
        },
        owner: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    return { pools };
  });

  fastify.get('/polls/:id', {
    onRequest: [authenticate]
  }, async (request) => {
    const getPoolParams = z.object({
      id: z.string()
    });

    const { id } = getPoolParams.parse(request.params);

    const pool = await prisma.pool.findUnique({
      where: {
        id
      },
      include: {
        _count: {
          select: {
            participant: true
          }
        },
        participant: {
          select: {
            id: true,
            user: {
              select: {
                avatarUrl: true,
              }
            }
          },
          take: 4
        },
        owner: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return { pool };
  });
};