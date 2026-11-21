#!/bin/sh
set -eu

if [ "$(id -u)" -eq 0 ]; then
  echo 'Run ./install.sh as your desktop user. It will call sudo for device permissions.' >&2
  exit 1
fi

cd "$(dirname "$0")"
binary=src-tauri/target/release/clanzi
if [ ! -x "$binary" ]; then
  echo 'Build clanzi first with ./build.sh' >&2
  exit 1
fi

destination="${HOME:?}/.local/bin/clanzi"
case ${XDG_DATA_HOME:-} in
  /*) data_dir=$XDG_DATA_HOME ;;
  *) data_dir=$HOME/.local/share ;;
esac
launcher="$data_dir/applications/clanzi.desktop"
install -Dm755 -T "$binary" "$destination"
install -Dm644 src-tauri/icons/128x128.png "$data_dir/icons/hicolor/128x128/apps/clanzi.png"
# The desktop session may have a different PATH from the user's shell.
entry=$(mktemp)
trap 'rm -f "$entry"' EXIT
sed 's|^Exec=clanzi$|Exec=/bin/sh -c "exec ~/.local/bin/clanzi"|' packaging/clanzi.desktop > "$entry"
install -Dm644 "$entry" "$launcher"
printf 'Installed %s\nInstalled %s\n' "$destination" "$launcher"

echo 'Configuring AU05 and uinput permissions (sudo may prompt for your password).'
for file in udev/rules.d/70-clanzi.rules modules-load.d/clanzi.conf; do
  source_file="packaging/${file##*/}"
  if [ -e "/etc/$file" ] || [ -L "/etc/$file" ]; then
    if ! cmp -s "$source_file" "/etc/$file"; then
      printf 'Keeping local override: /etc/%s. Check it if access still fails.\n' "$file" >&2
    fi
  elif ! cmp -s "$source_file" "/usr/lib/$file"; then
    sudo install -Dm644 -T "$source_file" "/etc/$file"
  fi
done

sudo modprobe uinput
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=misc --sysname-match=uinput
sudo udevadm trigger --subsystem-match=hidraw
sudo udevadm settle
echo 'In clanzi, open Settings and retry the connection. Replug the receiver if needed.'
