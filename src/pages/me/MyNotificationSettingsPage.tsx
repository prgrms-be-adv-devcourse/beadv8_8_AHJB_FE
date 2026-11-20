import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationApi } from '@/api/endpoints'
import { ErrorState } from '@/components/EmptyState'
import { Checkbox } from '@/components/form/Field'
import { Icon } from '@/components/Icon'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { NOTIFICATION_CATEGORY_LABELS, PUSH_CATEGORY_DESCRIPTIONS } from '@/lib/notification'
import type { NotificationSetting } from '@/types/notification'
import styles from './MyPage.module.css'

/** 브라우저 알림 권한 안내 문구 */
function permissionText(): string {
  if (typeof Notification === 'undefined') return '이 브라우저는 알림을 지원하지 않아요.'
  switch (Notification.permission) {
    case 'granted':
      return '이 브라우저에서 알림을 받을 수 있어요.'
    case 'denied':
      return '이 브라우저에서 알림이 차단돼 있어요. 주소창 왼쪽 자물쇠 아이콘 → 알림에서 허용으로 바꿔 주세요.'
    default:
      return '아직 브라우저 알림 권한을 묻지 않았어요. 첫 입찰이나 찜을 할 때 물어볼게요.'
  }
}

/** 알림 설정 /me/notifications. 묶음 4개 켜고 끄기 (계정 알림은 끌 수 없음) */
export function MyNotificationSettingsPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({ queryKey: ['notifications', 'settings'], queryFn: notificationApi.settings })

  const updateMutation = useMutation({
    mutationFn: (setting: NotificationSetting) => notificationApi.updateSettings({ settings: [setting] }),
    onSuccess: (result) => {
      queryClient.setQueryData(['notifications', 'settings'], result)
      toast('알림 설정을 바꿨어요.', { tone: 'success' })
    },
    onError: (error) => toast(error.message, { tone: 'error' }),
  })

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>알림 설정</h1>
      </div>
      <p className={styles.headSub}>
        끈 묶음은 휴대폰·브라우저 알림이 오지 않고 알림함에만 남아요. 계정 알림(경고·제재)은 끌 수 없어요.
      </p>
      {settingsQuery.isLoading ? (
        <Spinner block />
      ) : settingsQuery.isError ? (
        <ErrorState message={settingsQuery.error.message} onRetry={() => settingsQuery.refetch()} />
      ) : (
        <div className={styles.form}>
          {settingsQuery.data?.settings.map((setting) => (
            <Checkbox
              key={setting.category}
              label={`${NOTIFICATION_CATEGORY_LABELS[setting.category]} 알림`}
              description={PUSH_CATEGORY_DESCRIPTIONS[setting.category]}
              checked={setting.pushEnabled}
              disabled={updateMutation.isPending}
              onChange={(event) =>
                updateMutation.mutate({ category: setting.category, pushEnabled: event.target.checked })
              }
            />
          ))}
          <p className={styles.hint}>
            <Icon name="info" size={14} /> {permissionText()}
          </p>
        </div>
      )}
    </>
  )
}
