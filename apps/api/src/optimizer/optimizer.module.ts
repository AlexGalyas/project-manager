import { Module } from '@nestjs/common';
import { OptimizerController } from './optimizer.controller';
import { OptimizerService } from './optimizer.service';
import { GreedyOptimizer } from './strategies/greedy-optimizer';

@Module({
  controllers: [OptimizerController],
  providers: [OptimizerService, GreedyOptimizer],
  exports: [OptimizerService],
})
export class OptimizerModule {}
