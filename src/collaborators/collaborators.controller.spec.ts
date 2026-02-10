import { Test, TestingModule } from '@nestjs/testing';
import { CollaboratorsController } from './collaborators.controller';
import { CollaboratorsService } from './collaborators.service';

describe('CollaboratorsController', () => {
  let controller: CollaboratorsController;

  const mockCollaboratorsService = {
    requestCollaboration: jest.fn(),
    approveCollaborator: jest.fn(),
    removeCollaborator: jest.fn(),
    getCollaborators: jest.fn(),
    getPendingRequests: jest.fn(),
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashed',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCollaborator = {
    id: 'collab-1',
    workId: 'work-1',
    userId: 'user-1',
    approvedAt: null,
    user: {
      id: 'user-1',
      username: 'testuser',
      email: 'test@example.com',
      createdAt: new Date(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollaboratorsController],
      providers: [
        {
          provide: CollaboratorsService,
          useValue: mockCollaboratorsService,
        },
      ],
    }).compile();

    controller = module.get<CollaboratorsController>(CollaboratorsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('requestCollaboration', () => {
    it('should call service.requestCollaboration with correct params', async () => {
      mockCollaboratorsService.requestCollaboration.mockResolvedValue(
        mockCollaborator,
      );

      const result = await controller.requestCollaboration('work-1', mockUser);

      expect(result).toEqual(mockCollaborator);
      expect(
        mockCollaboratorsService.requestCollaboration,
      ).toHaveBeenCalledWith('work-1', 'user-1');
    });
  });

  describe('approveCollaborator', () => {
    it('should call service.approveCollaborator with correct params', async () => {
      const approvedCollab = { ...mockCollaborator, approvedAt: new Date() };
      mockCollaboratorsService.approveCollaborator.mockResolvedValue(
        approvedCollab,
      );

      const result = await controller.approveCollaborator(
        'work-1',
        'user-2',
        mockUser,
      );

      expect(result).toEqual(approvedCollab);
      expect(mockCollaboratorsService.approveCollaborator).toHaveBeenCalledWith(
        'work-1',
        'user-2',
        'user-1',
      );
    });
  });

  describe('removeCollaborator', () => {
    it('should call service.removeCollaborator with correct params', async () => {
      const response = { message: 'Collaborator removed successfully' };
      mockCollaboratorsService.removeCollaborator.mockResolvedValue(response);

      const result = await controller.removeCollaborator(
        'work-1',
        'user-2',
        mockUser,
      );

      expect(result).toEqual(response);
      expect(mockCollaboratorsService.removeCollaborator).toHaveBeenCalledWith(
        'work-1',
        'user-2',
        'user-1',
      );
    });
  });

  describe('getCollaborators', () => {
    it('should call service.getCollaborators with correct params', async () => {
      const collaborators = [mockCollaborator];
      mockCollaboratorsService.getCollaborators.mockResolvedValue(
        collaborators,
      );

      const result = await controller.getCollaborators('work-1');

      expect(result).toEqual(collaborators);
      expect(mockCollaboratorsService.getCollaborators).toHaveBeenCalledWith(
        'work-1',
      );
    });
  });

  describe('getPendingRequests', () => {
    it('should call service.getPendingRequests with correct params', async () => {
      const pendingRequests = [mockCollaborator];
      mockCollaboratorsService.getPendingRequests.mockResolvedValue(
        pendingRequests,
      );

      const result = await controller.getPendingRequests('work-1', mockUser);

      expect(result).toEqual(pendingRequests);
      expect(mockCollaboratorsService.getPendingRequests).toHaveBeenCalledWith(
        'work-1',
        'user-1',
      );
    });
  });
});
