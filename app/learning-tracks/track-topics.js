'use client';
import { useState } from 'react';
import { lessonTopic } from '../../lib/learning-track-topics.js';
import styles from './learning-tracks.module.css';

export default function TrackTopics({ track, videos, busy, onSave }) {
  const [selected, setSelected] = useState([]);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [mergeSource, setMergeSource] = useState('');
  const topics = track.topics || [];
  const unique = [...new Map(videos.map(video => [video.videoId, video])).values()];
  const selection = selected.filter(id => unique.some(video => video.videoId === id));
  async function save(action, extra) {
    if (await onSave(track, { action, ...extra })) {
      setSelected([]); setTitle(''); setTarget(''); setMergeSource('');
    }
  }
  return <details className={styles.topics}>
    <summary>Manage topics · {topics.length} groups</summary>
    <p>Choose related lessons to group them into a future Note. Ungrouped lessons use their own title. No Notes are created yet.</p>
    <div className={styles.topicList}>
      {unique.map(video => <label key={video.videoId} className={styles.topicLesson}>
        <input type="checkbox" checked={selection.includes(video.videoId)} onChange={event => setSelected(old => event.target.checked ? [...old, video.videoId] : old.filter(id => id !== video.videoId))} disabled={busy} />
        <span>{video.position + 1}. {video.title}<small>{lessonTopic(track, video).key.startsWith('topic:') ? lessonTopic(track, video).title : 'Individual lesson'}</small></span>
      </label>)}
    </div>
    <p>{selection.length} selected</p>
    <label>Existing topic<select value={target} onChange={event => setTarget(event.target.value)} disabled={busy}><option value="">New topic</option>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></label>
    <label>New topic name / rename<input maxLength={120} value={title} onChange={event => setTitle(event.target.value)} disabled={busy} /></label>
    <div className={styles.actions}>
      <button type="button" disabled={busy || !selection.length || (!target && !title.trim())} onClick={() => void save('assign-topic', { videoIds: selection, topicId: target, title })}>Assign selected</button>
      <button type="button" disabled={busy || !selection.length} onClick={() => void save('clear-topic', { videoIds: selection })}>Ungroup selected</button>
      <button type="button" disabled={busy || !target || !title.trim()} onClick={() => void save('rename-topic', { topicId: target, title })}>Rename topic</button>
    </div>
    {topics.length > 1 && <><label>Merge from<select value={mergeSource} onChange={event => setMergeSource(event.target.value)}><option value="">Choose topic</option>{topics.filter(topic => topic.id !== target).map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></label>
      <button type="button" disabled={busy || !target || !mergeSource || target === mergeSource} onClick={() => void save('merge-topic', { topicId: target, sourceTopicId: mergeSource })}>Merge into selected topic</button></>}
  </details>;
}
