<?php
declare(strict_types=1);
namespace Campus\Controllers;

use Campus\Http;
use Campus\Models\{Repository,Access};

final class ReportsController {
    public function __construct(private Repository $repo) {}
    public function handle(array $user): array {
        if (!Access::can($user,'reports.view')) Http::fail(403,'No tienes permiso para consultar resultados.');
        $learners=$this->repo->learners(); $courses=$this->repo->ownedCourseSummaries($user['id']);
        $rows=$this->repo->ownedLearnerAttempts($user['id']); $progress=$this->repo->ownedProgress($user['id']);
        $active=array_values(array_filter($courses,fn($c)=>(bool)$c['published']));
        $entries=[]; $learnerProgress=[];
        foreach ($learners as $learner) {
            $learner['courses']=[];
            foreach ($active as $course) {
                $attempts=array_values(array_filter($rows,fn($a)=>$a['user_id']===$learner['id'] && $a['course_id']===$course['id'] && $a['revision']===$course['revision']));
                $latest=$attempts[0] ?? null;
                $passed=(bool)array_filter($attempts,fn($a)=>(bool)$a['passed']);
                $completed=(bool)array_filter($progress,fn($p)=>$p['user_id']===$learner['id'] && $p['course_id']===$course['id'] && $p['completed']);
                $entry=['id'=>$course['id'],'title'=>$course['title'],'score'=>$latest['score'] ?? null,'attempts'=>count($attempts),'status'=>$passed ? 'passed' : ($latest ? 'retry' : ($completed ? 'ready' : 'pending'))];
                $learner['courses'][]=$entry; $entries[]=$entry;
            }
            $learnerProgress[]=$learner;
        }
        $summary=[];
        foreach ($courses as $course) {
            $items=array_filter($entries,fn($e)=>$e['id']===$course['id']);
            $summary[]=[...$course,'participants'=>$course['published'] ? count($learners) : 0,'passed'=>count(array_filter($items,fn($e)=>$e['status']==='passed')),'pending'=>count(array_filter($items,fn($e)=>$e['status']!=='passed'))];
        }
        $names=array_column($learners,'name','id'); $titles=array_column($courses,'title','id');
        $recent=array_map(fn($a)=>['id'=>$a['id'],'name'=>$names[$a['user_id']] ?? '', 'title'=>$titles[$a['course_id']] ?? '', 'score'=>$a['score'],'passed'=>$a['passed'],'created'=>$a['created']],array_slice($rows,0,6));
        return ['courses'=>$summary,'learners'=>$learnerProgress,'stats'=>['learners'=>count($learners),'published'=>count($active),'drafts'=>count($courses)-count($active),'passed'=>count(array_filter($entries,fn($e)=>$e['status']==='passed')),'pending'=>count(array_filter($entries,fn($e)=>$e['status']!=='passed')),'retry'=>count(array_filter($entries,fn($e)=>$e['status']==='retry'))],'recent'=>$recent];
    }
}
