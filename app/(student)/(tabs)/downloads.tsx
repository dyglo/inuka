import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Colors } from '../../../src/theme/colors';
import { Spacing, Typography } from '../../../src/theme';
import { Download, FileText, Trash2, ExternalLink, Play, X } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video, ResizeMode } from 'expo-av';
import { Modal, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';

interface OfflineFile {
  id: string;
  name: string;
  uri: string;
  type: 'video' | 'pdf';
  size: number;
}

export default function DownloadsScreen() {
  const [files, setFiles] = useState<OfflineFile[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const loadFiles = async () => {
    try {
      const docDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      if (!docDir) return;

      const downloadsStr = await AsyncStorage.getItem('course_downloads');
      if (!downloadsStr) {
        setFiles([]);
        return;
      }

      const downloads = JSON.parse(downloadsStr);
      const fileList: OfflineFile[] = [];

      for (const id in downloads) {
        const course = downloads[id];
        for (const type of course.files) {
          const fileName = type === 'video' ? `course_${id}_video.mp4` : `course_${id}_material.pdf`;
          const fileUri = docDir + fileName;
          const info = await FileSystem.getInfoAsync(fileUri);
          
          if (info.exists) {
            fileList.push({
              id,
              name: `${course.title} (${type === 'video' ? 'Video' : 'PDF'})`,
              uri: fileUri,
              type: type as 'video' | 'pdf',
              size: (info as any).size || 0,
            });
          }
        }
      }
      setFiles(fileList);
    } catch (e) {
      console.error(e);
    }
  };

  // Reload files every time this tab is focused (so newly downloaded files appear)
  useFocusEffect(
    useCallback(() => {
      loadFiles();
    }, [])
  );

  const handleOpenFile = async (file: OfflineFile) => {
    if (file.type === 'video') {
      setSelectedVideo(file.uri);
    } else {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri);
      } else {
        Alert.alert('Error', 'Sharing/Opening not available on this device');
      }
    }
  };

  const handleDelete = async (file: OfflineFile) => {
    Alert.alert('Delete', `Remove ${file.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await FileSystem.deleteAsync(file.uri);
          
          // Update metadata
          const downloadsStr = await AsyncStorage.getItem('course_downloads');
          if (downloadsStr) {
            const downloads = JSON.parse(downloadsStr);
            if (downloads[file.id]) {
              downloads[file.id].files = downloads[file.id].files.filter((f: string) => f !== file.type);
              if (downloads[file.id].files.length === 0) {
                delete downloads[file.id];
              }
              await AsyncStorage.setItem('course_downloads', JSON.stringify(downloads));
            }
          }
          
          loadFiles();
        },
      },
    ]);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Downloads</Text>
          <Text style={styles.subtitle}>{files.length} file{files.length !== 1 ? 's' : ''} offline</Text>
        </View>
        <TouchableOpacity onPress={loadFiles} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {files.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBg}>
            <Download size={40} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No Downloads Yet</Text>
          <Text style={styles.emptySubtitle}>
            Materials you download for offline use will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => item.uri}
          renderItem={({ item }) => (
            <View style={styles.fileCard}>
              <View style={styles.fileInfo}>
                <View style={[styles.fileIconBg, item.type === 'video' && styles.videoIconBg]}>
                  {item.type === 'video' ? (
                    <Play size={22} color={Colors.primary} fill={Colors.primary} />
                  ) : (
                    <FileText size={22} color={Colors.primary} />
                  )}
                </View>
                <View style={styles.fileMeta}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.fileSize}>{formatSize(item.size)}</Text>
                </View>
              </View>
              <View style={styles.fileActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleOpenFile(item)}
                >
                  <ExternalLink size={18} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDelete(item)}
                >
                  <Trash2 size={18} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Offline Video Player Modal */}
      <Modal
        visible={!!selectedVideo}
        animationType="fade"
        onRequestClose={() => setSelectedVideo(null)}
      >
        <View style={styles.playerContainer}>
          <TouchableOpacity 
            style={styles.closePlayer} 
            onPress={() => setSelectedVideo(null)}
          >
            <X color={Colors.white} size={30} />
          </TouchableOpacity>
          {selectedVideo && (
            <Video
              source={{ uri: selectedVideo }}
              style={styles.offlineVideo}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  refreshButton: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  refreshText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 18,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileIconBg: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  fileMeta: {
    flex: 1,
  },
  fileName: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  fileSize: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  fileActions: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  videoIconBg: {
    backgroundColor: 'rgba(26, 115, 232, 0.15)',
  },
  playerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  closePlayer: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  offlineVideo: {
    width: '100%',
    height: 300,
  },
});
