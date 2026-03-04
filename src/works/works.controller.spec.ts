import { Test, TestingModule } from '@nestjs/testing';
import { WorksController } from './works.controller';
import { WorksService } from './works.service';

describe('WorksController', () => {
  let controller: WorksController;

  const mockWorksService = {
    create: jest.fn(),
    getAll: jest.fn(),
    getMyWorks: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getCollaborators: jest.fn(),
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashedPassword',
    isEmailVerified: false,
    emailVerificationToken: null,
    emailVerificationTokenExpiresAt: null,
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWork = {
    id: 'work-1',
    title: 'Test Work',
    description: 'Test Description',
    type: 'novel',
    pageCharLimit: 2000,
    allowCollaboration: true,
    authorId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    author: {
      id: 'user-1',
      email: 'test@example.com',
      username: 'testuser',
      createdAt: new Date(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorksController],
      providers: [
        {
          provide: WorksService,
          useValue: mockWorksService,
        },
      ],
    }).compile();

    controller = module.get<WorksController>(WorksController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new work', async () => {
      const createDto = {
        title: 'Test Work',
        description: 'Test Description',
      };

      mockWorksService.create.mockResolvedValue(mockWork);

      const result = await controller.create(mockUser, createDto);

      expect(mockWorksService.create).toHaveBeenCalledWith(
        mockUser.id,
        createDto,
      );
      expect(result).toEqual(mockWork);
    });
  });

  describe('getAll', () => {
    it('should return paginated works', async () => {
      const paginatedResult = {
        data: [mockWork],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockWorksService.getAll.mockResolvedValue(paginatedResult);

      const result = await controller.getAll(1, 10);

      expect(mockWorksService.getAll).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(paginatedResult);
    });

    it('should use default pagination values', async () => {
      const paginatedResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      };

      mockWorksService.getAll.mockResolvedValue(paginatedResult);

      await controller.getAll(1, 10);

      expect(mockWorksService.getAll).toHaveBeenCalledWith(1, 10);
    });
  });

  describe('getMyWorks', () => {
    it('should return current user works', async () => {
      const userWorks = [mockWork];

      mockWorksService.getMyWorks.mockResolvedValue(userWorks);

      const result = await controller.getMyWorks(mockUser);

      expect(mockWorksService.getMyWorks).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(userWorks);
    });
  });

  describe('getById', () => {
    it('should return a work by id', async () => {
      mockWorksService.getById.mockResolvedValue(mockWork);

      const result = await controller.getById('work-1');

      expect(mockWorksService.getById).toHaveBeenCalledWith('work-1');
      expect(result).toEqual(mockWork);
    });
  });

  describe('update', () => {
    it('should update a work', async () => {
      const updateDto = {
        title: 'Updated Title',
      };
      const updatedWork = { ...mockWork, ...updateDto };

      mockWorksService.update.mockResolvedValue(updatedWork);

      const result = await controller.update('work-1', mockUser, updateDto);

      expect(mockWorksService.update).toHaveBeenCalledWith(
        'work-1',
        mockUser.id,
        updateDto,
      );
      expect(result).toEqual(updatedWork);
    });
  });

  describe('remove', () => {
    it('should delete a work', async () => {
      const deleteResult = { message: 'Work deleted successfully' };

      mockWorksService.remove.mockResolvedValue(deleteResult);

      const result = await controller.remove('work-1', mockUser);

      expect(mockWorksService.remove).toHaveBeenCalledWith(
        'work-1',
        mockUser.id,
      );
      expect(result).toEqual(deleteResult);
    });
  });

  describe('getCollaborators', () => {
    it('should return list of collaborators', async () => {
      const collaborators = [
        { userId: 'user-1', username: 'alice', pageCount: 12 },
        { userId: 'user-2', username: 'bob', pageCount: 8 },
      ];
      mockWorksService.getCollaborators.mockResolvedValue(collaborators);

      const result = await controller.getCollaborators('work-1');

      expect(result).toEqual(collaborators);
      expect(mockWorksService.getCollaborators).toHaveBeenCalledWith('work-1');
    });
  });
});
