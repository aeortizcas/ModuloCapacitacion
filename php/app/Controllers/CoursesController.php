<?php
declare(strict_types=1);
namespace Campus\Controllers;

use Campus\Http;
use Campus\Models\{Repository,Access};

final class CoursesController {
    public function __construct(private Repository $repo) {}
    public function handle(string $path, string $method, array $b, array $user): array {
        if ($path === '/courses' && $method === 'GET') {
            $courses=$this->repo->visibleCourses($user['id']);
            foreach ($courses as &$course) {
                $questions=json_decode($course['questions'],true,512,JSON_THROW_ON_ERROR);
                if ($user['role'] !== 'trainer' || $course['owner'] !== $user['id']) {
                    foreach ($questions as &$question) unset($question['correct']);
                    unset($question);
                }
                $course['questions']=$questions;
                $course['progress']=$this->repo->courseProgress($user['id'],$course['id']) ?? ['completed'=>0,'notes'=>''];
                $course['attempts']=$this->repo->courseAttempts($user['id'],$course['id']);
            }
            unset($course);
            return ['courses'=>$courses];
        }
        if (($path === '/courses' && $method === 'POST') || ($method === 'PUT' && preg_match('~^/courses/(\d+)$~D',$path,$match))) {
            if (!Access::can($user,'courses.manage')) Http::fail(403,'No tienes permiso para crear o editar cursos.');
            $id=$method === 'PUT' ? (int)$match[1] : null;
            $old=$id !== null ? $this->repo->ownedCourse($id,$user['id']) : null;
            if ($id !== null && !$old) Http::fail(404,'Capacitación no encontrada.');
            $title=Http::text($b['title'] ?? '',150); $content=Http::text($b['content'] ?? '',50000);
            if (!$title || !$content) Http::fail(400,'Agrega un título y contenido para estudiar.');
            if (!is_int($b['minutes'] ?? null) || $b['minutes']<1 || $b['minutes']>1000 || !is_int($b['pass'] ?? null) || $b['pass']<1 || $b['pass']>100) Http::fail(400,'Revisa la duración y la nota mínima.');
            if (!is_array($b['questions'] ?? null) || !array_is_list($b['questions']) || count($b['questions'])>50) Http::fail(400,'La prueba admite hasta 50 preguntas.');
            $questions=[];
            foreach ($b['questions'] as $q) {
                if (!is_array($q) || !Http::text($q['text'] ?? '',1000) || !is_array($q['options'] ?? null) || !array_is_list($q['options']) || count($q['options'])<2 || count($q['options'])>6 || !is_int($q['correct'] ?? null) || $q['correct']<0 || $q['correct']>=count($q['options'])) Http::fail(400,'Cada pregunta necesita opciones y una respuesta correcta.');
                $options=array_map(fn($option)=>Http::text($option,500),$q['options']);
                if (in_array('',$options,true)) Http::fail(400,'Las opciones no pueden estar vacías.');
                $questions[]=['text'=>Http::text($q['text'],1000),'options'=>$options,'correct'=>$q['correct']];
            }
            if (isset($b['published']) && !is_bool($b['published']) && !in_array($b['published'],[0,1],true)) Http::fail(400,'Estado de publicación inválido.');
            $published=!empty($b['published']);
            if (($published || !empty($old['published'])) && !Access::can($user,'courses.publish')) Http::fail(403,'Necesitas permiso de publicación para modificar cursos publicados.');
            if ($published && !$questions) Http::fail(400,'Agrega al menos una pregunta antes de publicar.');
            $encoded=json_encode($questions,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
            $fields=[$title,Http::text($b['category'] ?? '',80) ?: 'General',Http::text($b['description'] ?? '',600),$b['minutes'],$content,Http::youtube($b['video'] ?? ''),(int)$published,$b['pass'],$encoded];
            if ($id !== null) {
                $oldQuestions=json_decode($old['questions'],true,512,JSON_THROW_ON_ERROR);
                $revision=$old['revision']+(($oldQuestions !== $questions || $old['pass'] !== $b['pass']) ? 1 : 0);
                $this->repo->updateCourse(...[...$fields,$revision,$id]);
            } else $id=$this->repo->createCourse(...[...$fields,$user['id']]);
            return ['id'=>$id];
        }
        if ($method === 'POST' && preg_match('~^/courses/(\d+)/(progress|attempt)$~D',$path,$match)) {
            if ($user['role'] !== 'learner') Http::fail(403,'Solo los participantes registran avances y resuelven evaluaciones.');
            $course=$this->repo->publishedCourse((int)$match[1]);
            if (!$course) Http::fail(404,'Capacitación no disponible.');
            if ($match[2] === 'progress') {
                $previous=$this->repo->progressRecord($user['id'],$course['id']);
                if (isset($b['completed']) && !is_bool($b['completed'])) Http::fail(400,'Avance inválido.');
                $completed=array_key_exists('completed',$b) ? (int)$b['completed'] : ($previous['completed'] ?? 0);
                $notes=array_key_exists('notes',$b) ? Http::text($b['notes'],10000) : ($previous['notes'] ?? '');
                $this->repo->saveProgress($user['id'],$course['id'],$completed,$notes);
                return ['ok'=>true];
            }
            $questions=json_decode($course['questions'],true,512,JSON_THROW_ON_ERROR);
            if (($b['revision'] ?? null) !== $course['revision']) Http::fail(409,'La prueba cambió. Vuelve a abrir la capacitación.');
            $answers=$b['answers'] ?? null;
            if (!$questions || !is_array($answers) || !array_is_list($answers) || count($answers)!==count($questions)) Http::fail(400,'Responde todas las preguntas.');
            $correct=0;
            foreach ($answers as $i=>$answer) {
                if (!is_int($answer) || $answer<0 || $answer>=count($questions[$i]['options'])) Http::fail(400,'Responde todas las preguntas.');
                if ($answer === $questions[$i]['correct']) $correct++;
            }
            $score=(int)round($correct/count($questions)*100); $passed=$score >= $course['pass'];
            $this->repo->createAttempt($user['id'],$course['id'],$score,(int)$passed,json_encode($answers),$course['revision']);
            return ['score'=>$score,'passed'=>$passed,'correct'=>$correct,'total'=>count($questions)];
        }
        Http::fail(405,'Método no permitido.');
    }
}
